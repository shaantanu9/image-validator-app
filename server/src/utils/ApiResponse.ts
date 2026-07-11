export interface ApiSuccessResponse<T = unknown> {
  success: true;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
}

export class ApiResponse<T = unknown> {
  public readonly success: true;
  public readonly message: string;
  public readonly data: T;
  public readonly meta?: Record<string, unknown>;

  constructor(message: string, data: T, meta?: Record<string, unknown>) {
    this.success = true;
    this.message = message;
    this.data = data;
    this.meta = meta;
  }

  toJSON(): ApiSuccessResponse<T> {
    const response: ApiSuccessResponse<T> = {
      success: this.success,
      message: this.message,
      data: this.data,
    };

    if (this.meta) {
      response.meta = this.meta;
    }

    return response;
  }
}
