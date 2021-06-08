class BaseError implements Error {
    constructor(public message: string, public name: string) {
        Error.apply(this, [message]);
        if (typeof Error.captureStackTrace === 'function') {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

BaseError.prototype = Object.create(Error.prototype);

export class TimeOutError extends BaseError {
    public static is(err: any) {
        return err instanceof TimeOutError;
    }
    constructor(public message: string) {
        super(message, 'TimeOutError');
    }
}

export class ReconnectTimeError extends BaseError {
    public static is(err: any) {
        return err instanceof ReconnectTimeError;
    }
    constructor(public message: string) {
        super(message, 'ReconnectTimeError');
    }
}

export class InterceptorError extends BaseError {
    public static is(err: any) {
        return err instanceof InterceptorError;
    }
    constructor(public message: string, public data: any) {
        super(message, 'InterceptorError');
    }
}
