export interface IMiddleware<T = any> {
    (ctx: T, next: (params: any) => void): void;
}

export class Middleware<T = any> {
    private _middleware: IMiddleware[] = [];

    public start = (ctx: T, done: (data?: boolean) => void) => {
        let idx = 0;
        const len = this._middleware.length;
        const next = (final?: boolean) => {
            if (!final) return;
            if (idx >= len && final) return done(true);
            const fn = this._middleware[idx];
            idx++;
            fn(ctx, (res = final) => next(res));
        };
        next(true);
        return this;
    };

    public use(middleware: IMiddleware | Middleware) {
        if (middleware instanceof Middleware) {
            this._middleware.push(middleware.start);
        } else {
            this._middleware.push(middleware);
        }
        return this;
    }
}
