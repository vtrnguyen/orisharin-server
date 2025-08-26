import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Conversation, ConversationDocument } from './schemas/conversation.schema/conversation.schema';
import { ApiResponseDto } from 'src/common/dtos/api-response.dto';
import { User, UserDocument } from '../user/schemas/user.schema/user.schema';
import { extractCloudinaryPublicId } from 'src/common/functions/extract-cloudinary-public-id';
import { CloudinaryService } from 'src/common/cloudinary/cloudinary.service';

@Injectable()
export class ConversationService {
    constructor(
        @InjectModel(Conversation.name)
        private readonly conversationModel: Model<ConversationDocument>,
        @InjectModel(User.name)
        private readonly userModel: Model<UserDocument>,
        private cloudinaryService: CloudinaryService
    ) { }

    async create(conversationData: Partial<Conversation>, createdById?: string) {
        try {
            const participantIds = (conversationData.participantIds || []).map((p: any) => p.toString());
            if (!participantIds || participantIds.length < 2) {
                return new ApiResponseDto(null, "Participants have at least two members", false, "Participants number is less than two");
            }

            // ensure createdBy is included
            if (createdById && !participantIds.includes(createdById)) {
                participantIds.push(createdById);
            }

            const isGroup = !!conversationData.isGroup;

            const avatarUrl = conversationData.avatarUrl || '';

            if (!isGroup && participantIds.length === 2) {
                const existing = await this.conversationModel.findOne({
                    isGroup: false,
                    participantIds: { $size: 2, $all: participantIds.map(id => new Types.ObjectId(id)) }
                }).exec();

                if (existing) {
                    const populatedExisting = await this.conversationModel
                        .findById(existing._id)
                        .populate('participantIds', 'username fullName avatarUrl')
                        .lean()
                        .exec();

                    if (!populatedExisting) {
                        return new ApiResponseDto(null, "Conversation not found after lookup", false, "Conversation lookup failed");
                    }

                    const participants = (populatedExisting.participantIds || []).map((u: any) => ({
                        id: u._id,
                        username: u.username,
                        fullName: u.fullName,
                        avatarUrl: u.avatarUrl,
                    }));

                    const data = {
                        conversation: {
                            id: populatedExisting._id,
                            isGroup: populatedExisting.isGroup,
                            name: populatedExisting.name,
                            avatarUrl: (populatedExisting as any).avatarUrl || '',
                            createdBy: populatedExisting.createdBy,
                            createdAt: (populatedExisting as any).createdAt,
                            updatedAt: (populatedExisting as any).updatedAt,
                        },
                        participants
                    };

                    return new ApiResponseDto(data, "Conversation already exists", false);
                }
            }

            const created = await this.conversationModel.create({
                participantIds: participantIds.map(id => new Types.ObjectId(id)),
                isGroup: isGroup,
                name: conversationData.name || '',
                avatarUrl: avatarUrl,
                createdBy: createdById ? new Types.ObjectId(createdById) : undefined,
            } as Partial<Conversation>);

            const populated = await this.conversationModel
                .findById(created._id)
                .populate('participantIds', 'username fullName avatarUrl')
                .lean()
                .exec();

            if (!populated) {
                return new ApiResponseDto(null, "Conversation created but failed to populate", false, "Populate failed");
            }

            const participants = (populated.participantIds || []).map((u: any) => ({
                id: u._id,
                username: u.username,
                fullName: u.fullName,
                avatarUrl: u.avatarUrl,
            }));

            const data = {
                conversation: {
                    id: populated._id,
                    isGroup: populated.isGroup,
                    name: populated.name,
                    avatarUrl: (populated as any).avatarUrl || '',
                    createdBy: populated.createdBy,
                    createdAt: (populated as any).createdAt,
                    updatedAt: (populated as any).updatedAt,
                },
                participants
            };

            return new ApiResponseDto(data, "Conversation created successfully", true);
        } catch (error: any) {
            return new ApiResponseDto(null, error.message, false, "Create conversation failed");
        }
    }

    async updateAvatar(conversationId: string, file: Express.Multer.File, userId: string) {
        try {
            if (!file) return new ApiResponseDto(null, "no file uploaded", false, "file missing");

            const conv: any = await this.conversationModel.findById(conversationId).exec();
            if (!conv) return new ApiResponseDto(null, "conversation not found", false, "conversation not found");

            const isParticipant = (conv.participantIds || []).map((p: any) => String(p)).includes(String(userId));
            if (!isParticipant) return new ApiResponseDto(null, "unauthorized", false, "you are not a participant of this conversation");

            const oldUrl: string = (conv as any).avatarUrl || '';
            const publicId: string | null = extractCloudinaryPublicId(oldUrl);
            if (publicId) {
                try {
                    await this.cloudinaryService.deleteImage(publicId);
                } catch (error: any) { }
            }

            const uploadRes: any = await this.cloudinaryService.uploadImage(file);
            const newUrl = uploadRes?.secure_url || uploadRes?.url;
            if (!newUrl) return new ApiResponseDto(null, "upload failed", false, "cloudinary upload failed");

            conv.avatarUrl = newUrl;
            await conv.save();

            const populated = await this.conversationModel
                .findById(conv._id)
                .populate('participantIds', 'username fullName avatarUrl')
                .lean()
                .exec();

            return new ApiResponseDto({ conversation: populated }, "avatar updated successfully", true);
        } catch (error: any) {
            return new ApiResponseDto(null, error.message, false, "update avatar failed");
        }
    }

    async updateName(conversationId: string, name: string, userId: string) {
        try {
            if (!name || String(name).trim() === "") return new ApiResponseDto(null, "name is required", false, "bad request");

            const conv: any = await this.conversationModel.findById(conversationId).exec();
            if (!conv) return new ApiResponseDto(null, "conversation not found", false, "conversation not found");

            if (!conv.isGroup) return new ApiResponseDto(null, "cannot update name of a non-group conversation", false, "not a group conversation");

            const isParticipant = (conv.participantIds || []).map((p: any) => String(p)).includes(String(userId));
            if (!isParticipant) return new ApiResponseDto(null, "unauthorized", false, "you are not a participant of this conversation");

            conv.name = String(name).trim();
            await conv.save();

            const populated = await this.conversationModel
                .findById(conv._id)
                .populate('participantIds', 'username fullName avatarUrl')
                .lean()
                .exec();

            return new ApiResponseDto({ conversation: populated }, "name updated successfully", true);
        } catch (error: any) {
            return new ApiResponseDto(null, error.message, false, "update name failed");
        }
    }

    async findByUser(userId: string) {
        return this.conversationModel.find({ participantIds: userId }).exec();
    }

    async getConversationById(conversationId: string, currentUserId?: string) {
        try {
            const conv = await this.conversationModel
                .findById(conversationId)
                .populate('participantIds', 'username fullName avatarUrl')
                .lean()
                .exec();

            if (!conv) {
                return new ApiResponseDto(null, "Conversation not found", false, "Conversation not found");
            }

            if (currentUserId) {
                const isParticipant = (conv.participantIds || [])
                    .map((p: any) => String(p._id || p))
                    .includes(String(currentUserId));
                if (!isParticipant) {
                    return new ApiResponseDto(null, "Unauthorized", false, "You are not a participant of this conversation");
                }
            }

            const participants = (conv.participantIds || []).map((u: any) => ({
                id: u._id,
                username: u.username,
                fullName: u.fullName,
                avatarUrl: u.avatarUrl,
            }));

            const data = {
                conversation: {
                    id: conv._id,
                    isGroup: conv.isGroup,
                    name: conv.name,
                    avatarUrl: conv.avatarUrl || '',
                    createdBy: conv.createdBy,
                },
                participants,
            };

            return new ApiResponseDto(data, "Get conversation successfully", true);
        } catch (error: any) {
            return new ApiResponseDto(null, error.message, false, "Get conversation failed");
        }
    }

    async findAllByUserPaginated(userId: string, page = 1, limit = 10) {
        try {
            const p = Math.max(1, Number(page) || 1);
            const l = Math.max(1, Math.min(Number(limit) || 10, 100));
            const skip = (p - 1) * l;

            const userObjectId = new Types.ObjectId(userId);

            const [conversations, total] = await Promise.all([
                this.conversationModel
                    .find({ participantIds: { $in: [userObjectId] } })
                    .sort({ updatedAt: -1 })
                    .skip(skip)
                    .limit(l)
                    .populate("participantIds", "username fullName avatarUrl")
                    .lean()
                    .exec(),
                this.conversationModel.countDocuments({ participantIds: { $in: [userObjectId] } }).exec()
            ]);

            const data = conversations.map((conv: any) => {
                const participants = (conv.participantIds || []).map((u: any) => ({
                    id: u._id,
                    username: u.username,
                    fullName: u.fullName,
                    avatarUrl: u.avatarUrl,
                }));

                return {
                    conversation: {
                        id: conv._id,
                        isGroup: conv.isGroup,
                        name: conv.name,
                        avatarUrl: conv.avatarUrl || '',
                        createdBy: conv.createdBy,
                        createdAt: conv.createdAt,
                        updatedAt: conv.updatedAt,
                    },
                    participants
                };
            })

            return new ApiResponseDto(
                {
                    data,
                    total,
                    page: p,
                    limit: l,
                    hasMore: p * l < total,
                },
                "Get conversations successfully",
                true,
            );
        } catch (error: any) {
            return new ApiResponseDto(null, error.message, false, "Get conversations failed");
        }
    }
}
