import { forwardRef, Inject, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Message, MessageDocument } from "./schemas/message.schema/message.schema";
import { Conversation, ConversationDocument } from "../conversation/schemas/conversation.schema/conversation.schema";
import { ApiResponseDto } from "src/common/dtos/api-response.dto";
import { Reaction } from "src/common/enums/reaction.enum";
import { MessageGateway } from "./message.gateway";
import { User, UserDocument } from "../user/schemas/user.schema/user.schema";

@Injectable()
export class MessageService {
    constructor(
        @InjectModel(Message.name)
        private readonly messageModel: Model<MessageDocument>,
        @InjectModel(Conversation.name)
        private readonly conversationModel: Model<ConversationDocument>,
        @InjectModel(User.name)
        private readonly userModel: Model<UserDocument>,
        @Inject(forwardRef(() => MessageGateway))
        private readonly messageGateway: MessageGateway,
    ) { }

    async create(messageData: Partial<Message>) {
        const mediaUrls: string[] = Array.isArray(messageData.mediaUrls) ? messageData.mediaUrls.slice() : [];
        const content = (messageData.content || '').toString();
        const providedType = (messageData as any).type as string | undefined;
        const createdIds: Types.ObjectId[] = [];
        const nowBase = messageData.sentAt ? new Date(messageData.sentAt).getTime() : Date.now();

        // normalize senderId to ObjectId when possible
        let canonicalSenderId: Types.ObjectId | undefined = undefined;
        try {
            if (messageData.senderId) {
                canonicalSenderId = messageData.senderId instanceof Types.ObjectId
                    ? messageData.senderId
                    : new Types.ObjectId(String(messageData.senderId));
            }
        } catch (e) {
            canonicalSenderId = undefined;
        }

        try {
            if (mediaUrls.length > 0) {
                for (let i = 0; i < mediaUrls.length; i++) {
                    const url = mediaUrls[i];
                    const inferred = providedType || this.inferTypeFromUrl(url);
                    const sentAt = new Date(nowBase + i);
                    const md: Partial<Message> = {
                        ...messageData,
                        senderId: canonicalSenderId ?? (messageData.senderId as any),
                        content: '',
                        mediaUrls: [url],
                        type: inferred,
                        sentAt,
                    };
                    const created = await this.messageModel.create(md);
                    createdIds.push(created._id as Types.ObjectId);
                }

                if (content && content.trim() !== '') {
                    const sentAt = new Date(nowBase + mediaUrls.length);
                    const textType = providedType && providedType !== 'system' ? providedType : 'text';
                    const md: Partial<Message> = {
                        ...messageData,
                        senderId: canonicalSenderId ?? (messageData.senderId as any),
                        content,
                        mediaUrls: [],
                        type: textType,
                        sentAt,
                    };
                    const created = await this.messageModel.create(md);
                    createdIds.push(created._id as Types.ObjectId);
                }
            } else {
                const singleType = providedType || (messageData.type || 'text');
                const md: Partial<Message> = {
                    ...messageData,
                    senderId: canonicalSenderId ?? (messageData.senderId as any),
                    type: singleType,
                    sentAt: messageData.sentAt || new Date(),
                };
                const created = await this.messageModel.create(md);
                createdIds.push(created._id as Types.ObjectId);
            }

            const populated = await this.messageModel.find({ _id: { $in: createdIds } })
                .populate("senderId", "fullName username avatarUrl")
                .populate({ path: "reactions.userId", select: "fullName username avatarUrl" })
                .sort({ sentAt: 1 })
                .lean()
                .exec();

            const normalized = (populated || []).map((m: any) => {
                const s = m.senderId;
                if (!s) {
                    m.senderId = null;
                    return m;
                }
                if (typeof s === 'string' || (s && typeof s === 'object' && !('username' in s) && !('fullName' in s) && '_id' in s)) {
                    m.senderId = { _id: s };
                } else {
                    m.senderId = s;
                }
                return m;
            });

            const lastMsg = normalized[normalized.length - 1];
            if (lastMsg) {
                try {
                    const senderRef = lastMsg.senderId && (lastMsg.senderId._id ? lastMsg.senderId._id : lastMsg.senderId);
                    const lastMessageObj = {
                        _id: lastMsg._id,
                        content: lastMsg.content || '',
                        mediaUrls: lastMsg.mediaUrls || [],
                        senderId: senderRef,
                        type: lastMsg.type || 'text',
                        sentAt: lastMsg.sentAt || new Date()
                    };
                    await this.conversationModel.findByIdAndUpdate(
                        String(lastMsg.conversationId),
                        {
                            lastMessageId: lastMsg._id,
                            lastMessage: lastMessageObj,
                        },
                        { new: true }
                    ).exec();

                    // broadcast lastmessage updated to participants
                    try {
                        await this.messageGateway.broadcastConversationLastMessageUpdated(String(lastMsg.conversationId), lastMessageObj);
                    } catch (error: any) { }
                } catch (error: any) { }
            }

            return normalized.length === 1 ? normalized[0] : normalized;
        } catch (error: any) {
            throw error;
        }
    }

    async revoke(messageId: string, userId: string, forAll: boolean = false) {
        try {
            const msg: any = await this.messageModel.findById(messageId).exec();
            if (!msg) return new ApiResponseDto(null, "message not found", false, "message not found");

            const msgSenderId = String((msg.senderId && (msg.senderId._id ? msg.senderId._id : msg.senderId)) ?? msg.senderId);
            if (!msg.senderId || msgSenderId !== String(userId)) {
                return new ApiResponseDto(null, "unauthorized", false, "you are not the sender");
            }

            if (forAll) {
                const updatedMsg = await this.messageModel.findByIdAndUpdate(
                    messageId,
                    { $set: { isHideAll: true }, $unset: { hideForUsers: "" } },
                    { new: true }
                ).exec();

                try {
                    const convId = String(msg.conversationId);
                    if (updatedMsg) {
                        const senderRef = (updatedMsg.senderId && (updatedMsg.senderId as any)._id)
                            ? (updatedMsg.senderId as any)._id
                            : updatedMsg.senderId;
                        const lastMessageObj = {
                            _id: updatedMsg._id,
                            content: 'Message deleted',
                            mediaUrls: updatedMsg.mediaUrls || [],
                            senderId: senderRef,
                            type: updatedMsg.type || 'text',
                            sentAt: updatedMsg.sentAt || new Date(),
                            isHideAll: true
                        };

                        await this.conversationModel.findByIdAndUpdate(convId, {
                            lastMessageId: updatedMsg._id,
                            lastMessage: lastMessageObj,
                        }).exec();

                        try {
                            await this.messageGateway.broadcastConversationLastMessageUpdated(String(updatedMsg.conversationId), lastMessageObj);
                        } catch (error: any) { }
                    }
                } catch (e) { }

                return new ApiResponseDto({ id: messageId, conversationId: String(msg.conversationId), forAll: true }, "message hidden for all", true);
            } else {
                await this.messageModel.findByIdAndUpdate(
                    messageId,
                    { $addToSet: { hideForUsers: new Types.ObjectId(userId) }, $set: { isHideAll: false } },
                    { new: true }
                ).exec();

                return new ApiResponseDto({ id: messageId, conversationId: String(msg.conversationId), hiddenForUserId: userId }, "message hidden for user", true);
            }
        } catch (error: any) {
            return new ApiResponseDto(null, error.message || "delete failed", false, "delete failed");
        }
    }

    async react(messageId: string, userId: string, type: string) {
        try {
            const allowedTypes = Object.values(Reaction);
            if (!allowedTypes.includes(type as Reaction)) {
                return new ApiResponseDto(null, "invalid reaction", false, "invalid reaction");
            }

            const msg: any = await this.messageModel.findById(messageId).exec();
            if (!msg) return new ApiResponseDto(null, "message not found", false, "message not found");

            // verify participant
            const conv = await this.conversationModel.findById(msg.conversationId).exec();
            if (!conv || !conv.participantIds.map((p: any) => String(p)).includes(String(userId))) {
                return new ApiResponseDto(null, "unauthorized", false, "You are not a participant");
            }

            const existing = (msg.reactions || []).find((r: any) => String(r.userId) === String(userId));

            if (existing && existing.type === type) {
                // remove reaction
                await this.messageModel.findByIdAndUpdate(
                    messageId,
                    { $pull: { reactions: { userId: new Types.ObjectId(userId) } }, $inc: { [`reactionsCount.${type}`]: -1 } },
                    { new: true }
                ).exec();

                const updated = await this.messageModel.findById(messageId)
                    .populate("senderId", "fullName username avatarUrl")
                    .populate({ path: "reactions.userId", select: "fullName username avatarUrl" })
                    .exec();

                return new ApiResponseDto({ message: updated, action: 'removed', type }, "reaction removed", true);
            }

            if (existing && existing.type !== type) {
                // change reaction
                const from = existing.type;
                await this.messageModel.findOneAndUpdate(
                    { _id: messageId, 'reactions.userId': new Types.ObjectId(userId) },
                    { $set: { 'reactions.$.type': type }, $inc: { [`reactionsCount.${type}`]: 1, [`reactionsCount.${from}`]: -1 } },
                    { new: true }
                ).exec();

                const updated = await this.messageModel.findById(messageId)
                    .populate("senderId", "fullName username avatarUrl")
                    .populate({ path: "reactions.userId", select: "fullName username avatarUrl" })
                    .exec();

                return new ApiResponseDto({ message: updated, action: 'changed', from, to: type }, "reaction changed", true);
            }

            // add new reaction
            await this.messageModel.findByIdAndUpdate(
                messageId,
                { $push: { reactions: { userId: new Types.ObjectId(userId), type } }, $inc: { [`reactionsCount.${type}`]: 1 } },
                { new: true }
            ).exec();

            const updated = await this.messageModel.findById(messageId)
                .populate("senderId", "fullName username avatarUrl")
                .populate({ path: "reactions.userId", select: "fullName username avatarUrl" })
                .exec();

            if (updated) {
                try {
                    const actorReact = (updated.reactions || []).find((r: any) => {
                        const rid = r.userId?._id ? String(r.userId._id) : String(r.userId);
                        return rid === String(userId);
                    });

                    let actorName = 'Someone';
                    if (actorReact && actorReact.userId) {
                        const u = actorReact.userId as any;
                        actorName = (u.fullName || u.username) ? (u.fullName || u.username) : actorName;
                    }

                    let rawContent = String(updated.content || '').replace(/\s+/g, ' ').trim();
                    if (!rawContent) {
                        if (Array.isArray(updated.mediaUrls) && updated.mediaUrls.length > 0) {
                            rawContent = updated.type === 'video' ? 'a video' : 'a photo';
                        } else {
                            rawContent = '';
                        }
                    }

                    const PREVIEW_MAX = 120;
                    let preview = rawContent;
                    if (preview.length > PREVIEW_MAX) preview = preview.slice(0, PREVIEW_MAX) + '...';

                    const reactionText = `${actorName} reacted to "${preview}"`;

                    // update conversation lastMessage
                    try {
                        const senderRef = updated.senderId && (updated.senderId as any)._id ? (updated.senderId as any)._id : updated.senderId;
                        const lastMessageObj = {
                            _id: updated._id,
                            content: reactionText,
                            mediaUrls: updated.mediaUrls || [],
                            senderId: senderRef,
                            type: 'system',
                            sentAt: new Date()
                        };
                        await this.conversationModel.findByIdAndUpdate(
                            String(updated.conversationId),
                            {
                                lastMessageId: updated._id,
                                lastMessage: lastMessageObj,
                            },
                            { new: true }
                        ).exec();
                        try {
                            await this.messageGateway.broadcastConversationLastMessageUpdated(String(updated.conversationId), lastMessageObj);
                        } catch (error: any) { }
                    } catch (e) {
                        console.warn('Failed to update conversation.lastMessage after react', e);
                    }
                } catch (e) { }
            }

            return new ApiResponseDto({ message: updated, action: 'added', type }, "reaction added", true);
        } catch (error: any) {
            return new ApiResponseDto(null, error.message || "reaction failed", false, "reaction failed");
        }
    }

    async pin(messageId: string, userId: string) {
        try {
            const msg: any = await this.messageModel.findById(messageId)
                .populate('senderId', 'username fullName avatarUrl')
                .exec();
            if (!msg) return new ApiResponseDto(null, "message not found", false, "message not found");

            const conv: any = await this.conversationModel.findById(msg.conversationId).exec();
            if (!conv) return new ApiResponseDto(null, "conversation not found", false, "conversation not found");

            // participant check
            if (!conv.participantIds.map((p: any) => String(p)).includes(String(userId))) {
                return new ApiResponseDto(null, "unauthorized", false, "You are not a participant");
            }

            if (msg.isPinned) {
                return new ApiResponseDto({ id: messageId, conversationId: String(msg.conversationId) }, "message already pinned", true);
            }

            // set isPinned
            await this.messageModel.findByIdAndUpdate(messageId, { $set: { isPinned: true } }).exec();

            const senderDoc: any = msg.senderId && typeof msg.senderId === 'object' ? msg.senderId : null;
            const senderObj = {
                id: senderDoc && (senderDoc._id ? senderDoc._id : senderDoc) ? (senderDoc._id ?? senderDoc) : undefined,
                username: senderDoc?.username ?? '',
                fullName: senderDoc?.fullName ?? '',
                avatarUrl: senderDoc?.avatarUrl ?? '',
            };

            const pinnedObj: any = {
                messageId: msg._id,
                content: msg.content || '',
                pinnedBy: new Types.ObjectId(userId),
                pinnedAt: new Date(),
                sender: {
                    id: senderObj.id ? new Types.ObjectId(String(senderObj.id)) : undefined,
                    username: senderObj.username,
                    fullName: senderObj.fullName,
                    avatarUrl: senderObj.avatarUrl,
                }
            };

            // add to conversation
            await this.conversationModel.findByIdAndUpdate(
                conv._id,
                { $addToSet: { pinnedMessages: pinnedObj } }
            ).exec();

            try {
                const previewRaw = String(msg.content || '').replace(/\s+/g, ' ').trim() || (msg.mediaUrls && msg.mediaUrls.length ? (msg.type === 'video' ? 'a video' : 'a photo') : '');
                const PREVIEW_MAX = 120;
                let preview = previewRaw;
                if (preview.length > PREVIEW_MAX) preview = preview.slice(0, PREVIEW_MAX) + '...';

                const actorName = senderObj.fullName || senderObj.username || "Someone";
                const pinText = `${actorName} pinned a message.`;

                const sysMd: Partial<any> = {
                    conversationId: msg.conversationId,
                    senderId: new Types.ObjectId(String(userId)),
                    content: pinText,
                    type: 'system',
                    sentAt: new Date(),
                };

                const systemMsg = await this.messageModel.create(sysMd);
                const lastMessageObj = {
                    _id: systemMsg._id,
                    content: sysMd.content,
                    mediaUrls: [],
                    senderId: sysMd.senderId,
                    type: 'system',
                    sentAt: sysMd.sentAt,
                };

                // update conversation last message
                try {
                    await this.conversationModel.findByIdAndUpdate(
                        conv._id,
                        {
                            lastMessageId: systemMsg._id,
                            lastMessage: lastMessageObj,
                        },
                        { new: true }
                    ).exec();
                } catch (e) { }

                try {
                    await this.messageGateway.broadcastMessageCreated(String(msg.conversationId), systemMsg);
                } catch (e) { }

                try {
                    await this.messageGateway.broadcastConversationLastMessageUpdated(String(msg.conversationId), lastMessageObj);
                } catch (e) { }
            } catch (e) { }

            return new ApiResponseDto({ id: messageId, conversationId: String(msg.conversationId) }, "message pinned successfully", true);
        } catch (error: any) {
            return new ApiResponseDto(null, error.message || "pin failed", false, "pin failed");
        }
    }

    async unpin(messageId: string, userId: string) {
        try {
            const msg: any = await this.messageModel.findById(messageId).exec();
            if (!msg) return new ApiResponseDto(null, "message not found", false, "message not found");

            const conv: any = await this.conversationModel.findById(msg.conversationId).exec();
            if (!conv) return new ApiResponseDto(null, "conversation not found", false, "conversation not found");

            // participant check
            if (!conv.participantIds.map((p: any) => String(p)).includes(String(userId))) {
                return new ApiResponseDto(null, "unauthorized", false, "You are not a participant");
            }

            if (!msg.isPinned) {
                return new ApiResponseDto({ id: messageId, conversationId: String(msg.conversationId) }, "message not pinned", true);
            }

            await this.messageModel.findByIdAndUpdate(messageId, { $set: { isPinned: false } }).exec();

            await this.conversationModel.findByIdAndUpdate(
                conv._id,
                { $pull: { pinnedMessages: { messageId: new Types.ObjectId(messageId) } } }
            ).exec();

            try {
                const user = await this.userModel.findById(userId).lean().exec();
                const displayName = user ? (user.fullName || user.username || 'Someone') : 'Someone';

                const sysMd: Partial<any> = {
                    conversationId: msg.conversationId,
                    senderId: new Types.ObjectId(String(userId)),
                    content: `${displayName} unpinned a message.`,
                    type: 'system',
                    sentAt: new Date(),
                };

                const systemMsg = await this.messageModel.create(sysMd);
                const lastMessageObj = {
                    _id: systemMsg._id,
                    content: sysMd.content,
                    mediaUrls: [],
                    senderId: sysMd.senderId,
                    type: 'system',
                    sentAt: sysMd.sentAt,
                };

                try {
                    await this.conversationModel.findByIdAndUpdate(
                        conv._id,
                        {
                            lastMessageId: systemMsg._id,
                            lastMessage: lastMessageObj,
                        },
                        { new: true }
                    ).exec();
                } catch (e) { }

                try {
                    await this.messageGateway.broadcastMessageCreated(String(msg.conversationId), systemMsg);
                } catch (e) { }

                try {
                    await this.messageGateway.broadcastConversationLastMessageUpdated(String(msg.conversationId), lastMessageObj);
                } catch (e) { }
            } catch (e) { }

            return new ApiResponseDto({ id: messageId, conversationId: String(msg.conversationId) }, "message unpinned", true);
        } catch (error: any) {
            return new ApiResponseDto(null, error.message || "unpin failed", false, "unpin failed");
        }
    }

    async findByConversationPaginated(
        conversationId: string,
        page: number = 1,
        limit: number = 20
    ) {
        let convId: Types.ObjectId;
        try {
            convId = new Types.ObjectId(conversationId);
        } catch (e) {
            return new ApiResponseDto(
                {
                    messages: [],
                    hasMore: false,
                    total: 0,
                    page,
                    limit
                },
                "Invalid conversation id",
                false,
                "Invalid conversation id"
            );
        }

        const skip = (page - 1) * limit;

        const messages = await this.messageModel
            .find({ conversationId: convId })
            .populate("senderId", "fullName username avatarUrl")
            .populate({ path: "reactions.userId", select: "fullName username avatarUrl" })
            .sort({ sentAt: -1 })
            .skip(skip)
            .limit(limit)
            .exec();

        const total = await this.messageModel.countDocuments({ conversationId: convId });
        const hasMore = skip + messages.length < total;

        const payload = {
            messages: messages.reverse(),
            hasMore,
            total,
            page,
            limit
        };

        return new ApiResponseDto(payload, "Get messages successfully", true);
    }

    async findById(id: string) {
        return this.messageModel.findById(id).exec();
    }

    async isParticipant(conversationId: string, userId: string) {
        const conv = await this.conversationModel.findById(conversationId).exec();
        if (!conv) return false;
        return conv.participantIds.map(id => id.toString()).includes(userId);
    }

    async getParticipants(conversationId: string) {
        const conv = await this.conversationModel.findById(conversationId).exec();
        return conv ? conv.participantIds : [];
    }

    async markAsRead(messageId: string, userId: string) {
        return this.messageModel.findByIdAndUpdate(
            messageId,
            { $addToSet: { seenBy: userId } },
            { new: true }
        ).exec();
    }

    async markConversationAsRead(conversationId: string, userId: string) {
        return this.messageModel.updateMany(
            {
                conversationId,
                seenBy: { $ne: userId }
            },
            { $addToSet: { seenBy: userId } }
        ).exec();
    }

    private inferTypeFromUrl(url: string): 'image' | 'video' | 'audio' | 'file' {
        const imgExt = /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i;
        const videoExt = /\.(mp4|webm|ogg|mov|avi|mkv)(\?.*)?$/i;
        const audioExt = /\.(mp3|wav|aac|m4a|ogg)(\?.*)?$/i;

        if (videoExt.test(url)) return 'video';
        if (imgExt.test(url)) return 'image';
        if (audioExt.test(url)) return 'audio';
        return 'file';
    }
}
