
export class ApiResponseDto<T> {
    success: boolean;
    message: string;
    data: T;

    constructor(data: T, message = "", success = true) {
        this.data = data;
        this.message = message;
        this.success = success;
    }
}
