import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Conversation, ConversationDocument } from './schemas/conversation.schema/conversation.schema';
import { ApiResponseDto } from 'src/common/dtos/api-response.dto';
import { User, UserDocument } from '../user/schemas/user.schema/user.schema';
import { extractCloudinaryPublicId } from 'src/common/functions/extract-cloudinary-public-id';
import { CloudinaryService } from 'src/common/cloudinary/cloudinary.service';
import { MessageService } from '../message/message.service';
import { MessageGateway } from '../message/message.gateway';

@Injectable()
export class ConversationService {
    constructor(
        @InjectModel(Conversation.name)
        private readonly conversationModel: Model<ConversationDocument>,
        @InjectModel(User.name)
        private readonly userModel: Model<UserDocument>,
        private cloudinaryService: CloudinaryService,
        @Inject(forwardRef(() => MessageService))
        private messageService: MessageService,
        @Inject(forwardRef(() => MessageGateway))
        private messageGateway: MessageGateway,
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

            // create a system message indicating avatar change
            try {
                const user = await this.userModel.findById(userId).lean().exec();
                const displayName = user ? (user.fullName || user.username || 'Someone') : 'Someone';

                const md: Partial<any> = {
                    conversationId: conv._id,
                    senderId: new Types.ObjectId(String(userId)),
                    content: `${displayName} changed the conversation avatar.`,
                    type: 'system',
                    sentAt: new Date(),
                };

                const created = await this.messageService.create(md);

                if (created) {
                    await this.messageGateway.broadcastMessageCreated(conversationId, created);
                }
            } catch (error: any) {
                console.warn("failed to create/broadcast system message for conversation avatar change", error);
            }

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

            // create a system message indicating name change
            try {
                const user = await this.userModel.findById(userId).lean().exec();
                const displayName = user ? (user.fullName || user.username || 'Someone') : 'Someone';

                const md: Partial<any> = {
                    conversationId: conv._id,
                    senderId: new Types.ObjectId(String(userId)),
                    content: `${displayName} changed the conversation name to "${conv.name}".`,
                    type: 'system',
                    sentAt: new Date(),
                };

                const created = await this.messageService.create(md);

                if (created) {
                    await this.messageGateway.broadcastMessageCreated(conversationId, created);
                }
            } catch (error: any) {
                console.warn("failed to create/broadcast system message for conversation rename", error);
            }

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

    async updateTheme(conversationId: string, theme: string, userId: string) {
        try {
            if (!theme || String(theme).trim() === "") {
                return new ApiResponseDto(null, "theme is required", false, "bad request");
            }

            const conv: any = await this.conversationModel.findById(conversationId).exec();
            if (!conv) return new ApiResponseDto(null, "conversation not found", false, "conversation not found");

            // verify participant
            const isParticipant = (conv.participantIds || []).map((p: any) => String(p)).includes(String(userId));
            if (!isParticipant) return new ApiResponseDto(null, "unauthorized", false, "you are not a participant of this conversation");

            conv.theme = String(theme).trim();
            await conv.save();

            // create a system message to announce theme change
            try {
                const user = await this.userModel.findById(userId).lean().exec();
                const displayName = user ? (user.fullName || user.username || 'Someone') : 'Someone';

                const md: Partial<any> = {
                    conversationId: conv._id,
                    senderId: new Types.ObjectId(String(userId)),
                    content: `${displayName} changed the conversation theme to "${conv.theme}".`,
                    type: 'system',
                    sentAt: new Date(),
                };

                const created = await this.messageService.create(md);
                if (created) {
                    await this.messageGateway.broadcastMessageCreated(String(conv._id), created);
                }
            } catch (err: any) {
                console.warn('failed to create/broadcast system message for theme change', err);
            }

            const populated = await this.conversationModel
                .findById(conv._id)
                .populate('participantIds', 'username fullName avatarUrl')
                .lean()
                .exec();

            return new ApiResponseDto({ conversation: populated }, "theme updated successfully", true);
        } catch (error: any) {
            return new ApiResponseDto(null, error.message, false, "update theme failed");
        }
    }

    async addParticipants(conversationId: string, userIds: string[], currentUserId: string) {
        try {
            if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
                return new ApiResponseDto(null, "userIds are required", false, "bad request");
            }

            const incoming = Array.from(new Set(userIds.map(id => String(id).trim()).filter(Boolean)));
            if (incoming.length === 0) return new ApiResponseDto(null, "no valid userIds provided", false, "bad request");

            const conv: any = await this.conversationModel.findById(conversationId).exec();
            if (!conv) return new ApiResponseDto(null, "conversation not found", false, "conversation not found");

            if (!conv.isGroup) return new ApiResponseDto(null, "cannot add participants to a non-group conversation", false, "not a group conversation");

            // only user in conversation can add new members
            const callerIsParticipant = (conv.participantIds || []).map((p: any) => String(p)).includes(String(currentUserId));
            if (!callerIsParticipant) return new ApiResponseDto(null, "unauthorized", false, "you are not a participant of this conversation");

            // check userIds actually exist
            const objectIds = incoming.map(id => {
                try { return new Types.ObjectId(id); } catch { return null; }
            }).filter((o): o is Types.ObjectId => !!o);

            if (objectIds.length === 0) return new ApiResponseDto(null, "no valid userIds provided", false, "bad request");

            const existingUsers = await this.userModel.find(
                { _id: { $in: objectIds } },
                { _id: 1, username: 1, fullName: 1, avatarUrl: 1 }
            ).lean().exec();
            const existingIdsSet = new Set(existingUsers.map((u: any) => String(u._id)));

            const notFound = incoming.filter(id => !existingIdsSet.has(id));

            // compute toAdd = existing ids that are not already participants
            const alreadySet = new Set((conv.participantIds || []).map((p: any) => String(p)));
            const toAddIds = Array.from(existingUsers.map((u: any) => String(u._id))).filter(id => !alreadySet.has(id));
            if (toAddIds.length === 0) {
                // nothing to add
                const populated = await this.conversationModel.findById(conv._id)
                    .populate('participantIds', 'username fullName avatarUrl')
                    .lean()
                    .exec();

                return new ApiResponseDto({ conversation: populated, added: [], skipped: incoming, notFound }, "No new participants added", true);
            }

            // add them atomically with $addToSet + $each
            const toAddObjectIds = toAddIds.map(id => new Types.ObjectId(id));
            await this.conversationModel.findByIdAndUpdate(conv._id, { $addToSet: { participantIds: { $each: toAddObjectIds } } }).exec();

            // return populated conversation and lists
            const populatedAfter = await this.conversationModel.findById(conv._id)
                .populate('participantIds', 'username fullName avatarUrl')
                .lean()
                .exec();

            // create a system message indicating new participants added
            try {
                // adder info
                const actorUser = await this.userModel.findById(currentUserId).lean().exec();
                const actorName = actorUser ? (actorUser.fullName || actorUser.username || 'Someone') : 'Someone';
                // first added users info
                const addedDocs = (existingUsers || []).filter((u: any) => toAddIds.includes(String(u._id)));
                const firstAddedName = addedDocs[0] ? (addedDocs[0].fullName || addedDocs[0].username || 'Someone') : (toAddIds[0] || 'Someone');

                let content: string = '';
                if (toAddIds.length === 1) {
                    content = `${actorName} added ${firstAddedName} to the group.`;
                } else {
                    const others = toAddIds.length - 1;
                    content = `${actorName} added ${firstAddedName} and ${others} other${others > 1 ? 's' : ''} to the group.`;
                }

                const md: Partial<any> = {
                    conversationId: conv._id,
                    senderId: new Types.ObjectId(String(currentUserId)),
                    content,
                    type: 'system',
                    sentAt: new Date(),
                };

                const created = await this.messageService.create(md);
                await this.messageGateway.broadcastMessageCreated(conversationId, created);
            } catch (error: any) {
                console.warn("failed to create/broadcast system message for adding participants", error);
            }

            // built added/skipped arrays for response
            const added = toAddIds;
            const skipped = incoming.filter(id => !added.includes(id) && !notFound.includes(id)); // already existing

            return new ApiResponseDto({ conversation: populatedAfter, added, skipped, notFound }, "Participants added successfully", true);
        } catch (error: any) {
            return new ApiResponseDto(null, error.message, false, "add participants failed");
        }
    }

    async removeParticipants(conversationId: string, userIds: string[], currentUserId: string) {
        try {
            if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
                return new ApiResponseDto(null, "userIds are required", false, "bad request");
            }

            const incoming = Array.from(new Set(userIds.map(id => String(id).trim()).filter(Boolean)));
            if (incoming.length === 0) return new ApiResponseDto(null, "no valid userIds provided", false, "bad request");

            const conv: any = await this.conversationModel.findById(conversationId).exec();
            if (!conv) return new ApiResponseDto(null, "conversation not found", false, "conversation not found");

            if (!conv.isGroup) return new ApiResponseDto(null, "cannot remove participants from a non-group conversation", false, "not a group conversation");

            // only admin (createdBy) can remove other members
            if (!conv.createdBy || String(conv.createdBy) !== String(currentUserId)) {
                return new ApiResponseDto(null, "forbidden", false, "only the conversation admin can remove participants");
            }

            // validate userIds exist
            const objectIds = incoming.map(id => {
                try { return new Types.ObjectId(id); } catch { return null; }
            }).filter((o): o is Types.ObjectId => !!o);

            if (objectIds.length === 0) return new ApiResponseDto(null, "no valid userIds provided", false, "bad request");

            const existingUsers = await this.userModel.find(
                { _id: { $in: objectIds } },
                { _id: 1, username: 1, fullName: 1, avatarUrl: 1 }
            ).lean().exec();
            const existingIdsSet = new Set(existingUsers.map((u: any) => String(u._id)));
            const notFound = incoming.filter(id => !existingIdsSet.has(id));

            // compute toRemove = existing ids that are currently participants
            const alreadySet = new Set((conv.participantIds || []).map((p: any) => String(p)));
            // do not allow removing the creator/admin themselves
            const creatorIdStr = conv.createdBy ? String(conv.createdBy) : null;
            const toRemoveIds = Array.from(existingUsers.map((u: any) => String(u._id)))
                .filter(id => alreadySet.has(id) && id !== creatorIdStr);

            if (toRemoveIds.length === 0) {
                const populated = await this.conversationModel.findById(conv._id)
                    .populate('participantIds', 'username fullName avatarUrl')
                    .lean()
                    .exec();
                const skipped = incoming.filter(id => !toRemoveIds.includes(id) && !notFound.includes(id));
                return new ApiResponseDto({ conversation: populated, removed: [], skipped, notFound }, "No participants removed", true);
            }

            const toRemoveObjectIds = toRemoveIds.map(id => new Types.ObjectId(id));
            // remove them
            await this.conversationModel.findByIdAndUpdate(conv._id, { $pull: { participantIds: { $in: toRemoveObjectIds } } }).exec();

            // fetch remainder
            const after = await this.conversationModel.findById(conv._id).exec();
            const remaining = (after?.participantIds || []).map((p: any) => String(p));

            // if no participants remain, delete the conversation
            if (!after || (after.participantIds || []).length === 0) {
                await this.conversationModel.findByIdAndDelete(conv._id).exec();
                return new ApiResponseDto({ conversation: null, removed: toRemoveIds, skipped: [], notFound }, "Participants removed — conversation deleted (no participants remain)", true);
            }

            // defensive: if createdBy somehow got removed (shouldn't happen here), reassign
            if (after && after.createdBy && !remaining.includes(String(after.createdBy))) {
                const newCreatedBy = remaining.length ? new Types.ObjectId(remaining[0]) : undefined;
                await this.conversationModel.findByIdAndUpdate(conv._id, { $set: { createdBy: newCreatedBy } }).exec();
            }

            const populatedAfter = await this.conversationModel.findById(conv._id)
                .populate('participantIds', 'username fullName avatarUrl')
                .lean()
                .exec();

            // create a system message indicating participants removed
            try {
                const actorUser = await this.userModel.findById(currentUserId).lean().exec();
                const actorName = actorUser ? (actorUser.fullName || actorUser.username || 'Someone') : 'Someone';

                const removedDocs = (existingUsers || []).filter((u: any) => toRemoveIds.includes(String(u._id)));
                const firstRemovedName = removedDocs[0] ? (removedDocs[0].fullName || removedDocs[0].username || 'Someone') : (toRemoveIds[0] || 'Someone');

                let content: string = '';
                if (toRemoveIds.length === 1) {
                    content = `${actorName} removed ${firstRemovedName} from the group.`;
                } else {
                    const others = toRemoveIds.length - 1;
                    content = `${actorName} removed ${firstRemovedName} and ${others} other${others > 1 ? 's' : ''} from the group.`;
                }

                const md: Partial<any> = {
                    conversationId: conv._id,
                    senderId: new Types.ObjectId(String(currentUserId)),
                    content,
                    type: 'system',
                    sentAt: new Date(),
                };

                const created = await this.messageService.create(md);
                if (created) {
                    await this.messageGateway.broadcastMessageCreated(conversationId, created);
                }
            } catch (err: any) {
                console.warn('failed to create/broadcast system message for removed participants', err);
            }

            const removed = toRemoveIds;
            const skipped = incoming.filter(id => !removed.includes(id) && !notFound.includes(id)); // e.g. not participants or creator

            return new ApiResponseDto({ conversation: populatedAfter, removed, skipped, notFound }, "Participants removed successfully", true);
        } catch (error: any) {
            return new ApiResponseDto(null, error.message, false, "remove participants failed");
        }
    }

    async leaveConversation(conversationId: string, currentUserId: string) {
        try {
            const conv: any = await this.conversationModel.findById(conversationId).exec();
            if (!conv) return new ApiResponseDto(null, "conversation not found", false, "conversation not found");

            const isParticipant = (conv.participantIds || []).map((p: any) => String(p)).includes(String(currentUserId));
            if (!isParticipant) return new ApiResponseDto(null, "unauthorized", false, "you are not a participant of this conversation");

            // admin cannot leave. Require admin to transfer ownership or delete the conversation.
            if (conv.createdBy && String(conv.createdBy) === String(currentUserId)) {
                return new ApiResponseDto(null, "admin cannot leave the group; transfer admin or delete the group first", false, "admin cannot leave");
            }

            // non-group (1:1) - leaving will delete conversation for both participants
            if (!conv.isGroup) {
                return new ApiResponseDto(null, "you can't leave with non-group conversations", false);
            }

            // group: remove current user
            await this.conversationModel.findByIdAndUpdate(conv._id, { $pull: { participantIds: new Types.ObjectId(currentUserId) } }).exec();

            // fetch remainder
            const after = await this.conversationModel.findById(conv._id).exec();
            const remaining = (after?.participantIds || []).map((p: any) => String(p));

            // if no participants left, delete conversation
            if (!after || remaining.length === 0) {
                await this.conversationModel.findByIdAndDelete(conv._id).exec();
                return new ApiResponseDto({ conversation: null }, "You left and conversation deleted (no participants remain)", true);
            }

            // if createdBy removed (shouldn't happen since admin can't leave), reassign defensively
            if (after && after.createdBy && !remaining.includes(String(after.createdBy))) {
                const newCreatedBy = remaining.length ? new Types.ObjectId(remaining[0]) : undefined;
                await this.conversationModel.findByIdAndUpdate(conv._id, { $set: { createdBy: newCreatedBy } }).exec();
            }

            const populatedAfter = await this.conversationModel.findById(conv._id)
                .populate('participantIds', 'username fullName avatarUrl')
                .lean()
                .exec();

            // create a system message indicating user left
            try {
                const actorUser = await this.userModel.findById(currentUserId).lean().exec();
                const actorName = actorUser ? (actorUser.fullName || actorUser.username || 'Someone') : 'Someone';

                const content = `${actorName} left the group.`;

                const md: Partial<any> = {
                    conversationId: conv._id,
                    senderId: new Types.ObjectId(String(currentUserId)),
                    content,
                    type: 'system',
                    sentAt: new Date(),
                };

                const created = await this.messageService.create(md as any);
                if (created) {
                    await this.messageGateway.broadcastMessageCreated(conversationId, created);
                }
            } catch (err: any) {
                console.warn('failed to create/broadcast system message for leaving conversation', err);
            }

            return new ApiResponseDto({ conversation: populatedAfter }, "You have left the conversation", true);
        } catch (error: any) {
            return new ApiResponseDto(null, error.message, false, "leave conversation failed");
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
                conversation: conv,
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
                    conversation: conv,
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
