import { Request, Router } from "express";
import { Injector } from "./injectors";
import { HttpResponse } from "./response";
import {
    BodyValidator,
    NoopValidator,
    ParamsValidator,
    QueryValidator,
} from "./validators";

type TODO = any;

export type Middleware<TParams, TBody, TQuery> =
    | ParamsValidator<TParams>
    | BodyValidator<TBody>
    | QueryValidator<TQuery>
    | NoopValidator;

interface Resolved<TParams, TBody, TQuery> {
    params: TParams;
    body: TBody;
    query: TQuery;
}

type Resolver<
    TInjected,
    TParams,
    TBody,
    TQuery,
    TResult extends HttpResponse<any>
> = (
    props: TInjected & Resolved<TParams, TBody, TQuery>
) => TResult | Promise<TResult>;

export const tsRouter = <TRequest extends Request>() => <TInjected>({
    injector,
    logger,
}: {
    injector: Injector<TRequest, TInjected>;
    logger: TODO;
}) => ({
    controller,
    path: basePath,
}: {
    controller: string;
    path: string;
}) => {
    const router = Router({ mergeParams: true });
    const addHandler = (httpMethod: "post" | "get" | "put" | "delete") => <
        TParams,
        TBody,
        TQuery,
        TResult extends HttpResponse<any>
    >({
        path,
        middleware,
        resolver,
        method,
        authorization,
    }: {
        path: string;
        middleware: Array<Middleware<TParams, TBody, TQuery>>;
        resolver: Resolver<TInjected, TParams, TBody, TQuery, TResult>;
        method: string;
        authorization: AuthorizeMiddleware;
    }) => {
        router[httpMethod](
            path,
            authorization,
            ...middleware,
            async (req, res) => {
                logger.info({ controller, method, req }, "Incoming request");
                const span = extractSpan(req, { controller, method });
                try {
                    span.logEvent("Request started", undefined);
                    span.addTags({
                        userId: req.user?.id,
                        organizationId: req.user?.organizationId,
                    });
                    logger.info(
                        { controller, method, req },
                        "Running injector"
                    );
                    const injections = injector(req as TRequest, {
                        controller,
                        method,
                        span,
                    });

                    logger.info(
                        { controller, method, req },
                        "Running resolver"
                    );
                    const result = await resolver({
                        ...injections,
                        span,
                        body: req.body,
                        params: req.params,
                        query: req.query,
                    });

                    logger.info(
                        { controller, method, req },
                        "Request succeeded"
                    );
                    span.logEvent("Request succeeded", undefined);

                    res.status(result.code).send(result.content);
                } catch (err) {
                    logger.error({ controller, method, req }, "Request failed");
                    span.logEvent("Request failed", err.message);
                    span.setTag(Tags.ERROR, true);
                    return res.status(500).send(err.message);
                } finally {
                    span.finish();
                }
            }
        );

        return {
            test: resolver,
        };
    };
    return {
        post: addHandler("post"),
        get: addHandler("get"),
        put: addHandler("put"),
        delete: addHandler("delete"),
        apply: (expressRouter: Router) => expressRouter.use(basePath, router),
    };
};
