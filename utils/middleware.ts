export interface IMiddleware<T = any> {
    (ctx: T, next: (final?: boolean, reason?: any) => void): void;
}

export class Middleware<T = any> {
    private _middleware: IMiddleware[] = [];

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
            const fn = this._middleware[idx];
            idx++;
            fn(ctx, next);
        };
        next();
        return this;
    };

    public use(middleware: IMiddleware<T> | Middleware<T>) {
        if (middleware instanceof Middleware) {
            this._middleware.push(middleware.start);
        } else {
            this._middleware.push(middleware);
        }
        return this;
    }
}
