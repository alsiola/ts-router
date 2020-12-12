import { Request } from "express";

interface InjectorCtx {
    controller: string;
    method: string;
}

export type Injector<TRequest extends Request, TInjected> = (
    req: TRequest,
    ctx: InjectorCtx
) => TInjected;

type Inject2<T, U> = T extends Injector<any, infer IT>
    ? U extends Injector<any, infer IU>
        ? IT & IU
        : never
    : never;

export function combineInjectors<
    TRequest extends Request,
    I1 extends Injector<TRequest, any>,
    I2 extends Injector<TRequest, any>
>(i1: I1, i2: I2): Injector<TRequest, Inject2<I1, I2>> {
    return (req: TRequest, ctx: InjectorCtx) =>
        [i1, i2].reduce(
            (out, curr) => ({ ...out, ...curr(req, ctx) }),
            {} as Inject2<I1, I2>
        );
}
