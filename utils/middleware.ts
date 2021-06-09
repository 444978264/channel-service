export interface INext {
    (final?: boolean, reason?: any): void;
}

export interface IMiddleware<T = any> {
    (ctx: T, next: INext): void;
}

export class Middleware<T = any> {
    private _middleware: (IMiddleware | Middleware)[] = [];

    public start = (
        ctx: T,
        success: (final?: boolean) => void,
        fail?: (ctx: T, reason?: any) => void,
    ) => {
        let idx = 0;
        const len = this._middleware.length;
        const next = (final = true, reason?: any) => {
            if (!final) return fail && fail(ctx, reason);
            if (idx >= len && final) return success(true);
            const middleware = this._middleware[idx];
            idx++;
            if (middleware instanceof Middleware) {
                middleware.start(ctx, next, fail);
            } else {
                middleware(ctx, next);
            }
        };
        next();
        return this;
    };

    public use(middleware: IMiddleware<T> | Middleware<T>) {
        this._middleware.push(middleware);
        return this;
    }

    public eject(callback: IMiddleware) {
        const idx = this._middleware.indexOf(callback);
        if (idx > -1) this._middleware.splice(idx, 1);
        return this;
    }
}
