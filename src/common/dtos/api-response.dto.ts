
export class ApiResponseDto<T> {
    success: boolean;
    message: string;
    data: T;
    error: string | null;

    constructor(data: T, message = "", success = true, error: string | null = null) {
        this.data = data;
        this.message = message;
        this.success = success;
        this.error = error;
    }
}
