class BaseError implements Error {
    public __ERROR__ = true;
    constructor(public message: string, public name: string) {
        Error.apply(this, [message]);
        if (typeof Error.captureStackTrace === 'function') {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

BaseError.prototype = Object.create(Error.prototype);

export class TimeOutError extends BaseError {
    public static is(err: any): err is TimeOutError {
        return err.name === 'TimeOutError' && err.__ERROR__;
    }
    constructor(public message: string) {
        super(message, 'TimeOutError');
    }
}

export class ReconnectTimeError extends BaseError {
    public static is(err: any): err is ReconnectTimeError {
        return err.name === 'ReconnectTimeError' && err.__ERROR__;
    }
    constructor(public message: string) {
        super(message, 'ReconnectTimeError');
    }
}

export class InterceptorError<T = any> extends BaseError {
    public static is(err: any): err is InterceptorError {
        return err.name === 'InterceptorError' && err.__ERROR__;
    }
    constructor(public message: string, public data: T) {
        super(message, 'InterceptorError');
    }
}
