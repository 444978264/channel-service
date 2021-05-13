import {ICancelToken, CancelToken} from './CancelToken';

export interface ICancelRequest<T = any> {
    then: Promise<T>['then'];
    finally: Promise<T>['finally'];
    catch: Promise<T>['catch'];
    abort: ICancelToken<any>['abort'];
}

interface IWithCancelToken {
    <T = any>(...args: any[]): Promise<T>;
}

export class CancelTokenFactory {
    constructor(private CancelToken?: CancelToken) {}
    withCancelToken<T>(request: IWithCancelToken) {
        if (!(this.CancelToken instanceof CancelToken)) {
            throw new Error();
        }
        const source = this.CancelToken?.createCancelToken();
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const {abort, dispose, ...other} = source;
        return (params: any[]): ICancelRequest<T> => {
            const promise = request<T>({
                ...params,
                ...other,
            });
            return {
                then: promise.then.bind(promise),
                finally: (callback?: () => any) => {
                    return promise.finally(() => {
                        callback && callback();
                        source.dispose();
                    });
                },
                catch: promise.catch.bind(promise),
                abort: (message?: string) => {
                    source.abort(message);
                },
            };
        };
    }
}
