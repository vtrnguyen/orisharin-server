import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Conversation, ConversationDocument } from './schemas/conversation.schema/conversation.schema';
import { ApiResponseDto } from 'src/common/dtos/api-response.dto';

@Injectable()
export class ConversationService {
    constructor(
        @InjectModel(Conversation.name)
        private readonly conversationModel: Model<ConversationDocument>,
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

            if (!isGroup && participantIds.length === 2) {
                const existing = await this.conversationModel.findOne({
                    isGroup: false,
                    participantIds: { $size: 2, $all: participantIds.map(id => new Types.ObjectId(id)) }
                }).exec();

                if (existing) {
                    return new ApiResponseDto(existing, "Conversation already exists", true);
                }
            }

            const created = await this.conversationModel.create({
                participantIds: participantIds.map(id => new Types.ObjectId(id)),
                isGroup: isGroup,
                name: conversationData.name || '',
                createdBy: createdById ? new Types.ObjectId(createdById) : undefined,
            } as Partial<Conversation>);

            return new ApiResponseDto(created, "Conversation created successfully", true);
        } catch (error: any) {
            return new ApiResponseDto(null, error.message, false, "Create conversation failed");
        }
    }

    async findByUser(userId: string) {
        return this.conversationModel.find({ participantIds: userId }).exec();
    }

    async findById(id: string) {
        return this.conversationModel.findById(id).exec();
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
