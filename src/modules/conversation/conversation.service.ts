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
}
