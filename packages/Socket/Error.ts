export class TimeOutError extends Error {
    public static is(err: any) {
        return err instanceof TimeOutError;
    }
    constructor(public message: string = '') {
        super();
        this.name = 'TimeOutError';
        this.stack = new Error().stack;
    }
}

export class ReconnectTimeError extends Error {
    public static is(err: any) {
        return err instanceof ReconnectTimeError;
    }
    constructor(public message: string = '') {
        super();
        this.name = 'ReconnectTimeError';
        this.stack = new Error().stack;
    }
}
