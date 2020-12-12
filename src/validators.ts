import { NextFunction, Request, Response } from "express";
import { get, set } from "lodash";
import logger from "utils/logger";
import * as yup from "yup";

export type BodyValidator<T> = (
    req: any,
    res: Response,
    next: NextFunction
) => req is { body: T };

export type QueryValidator<T> = (
    req: any,
    res: Response,
    next: NextFunction
) => req is { query: T };

export type ParamsValidator<T> = (
    req: any,
    res: Response,
    next: NextFunction
) => req is { params: T };

export type NoopValidator = (
    req: any,
    res: Response,
    next: NextFunction
) => void;

const formatValidationErrors = (err: any) => {
    const surveyErrors: object = {};

    if (err.inner) {
        err.inner.forEach(({ type, name, path, errors }) => {
            if (name && path && errors) {
                if (type === "noUnknown") {
                    const unknownErrors = get(surveyErrors, "additionalFields");
                    set(
                        surveyErrors,
                        "additionalFields",
                        unknownErrors && Array.isArray(unknownErrors)
                            ? [...unknownErrors, ...errors]
                            : errors
                    );
                    return;
                }
                surveyErrors[path] = errors;
            }
        });
        return surveyErrors;
    }
    return err.message;
};

/**
 * yup schema inference is broken and makes all fields optional. For now, the
 * best solution is to mark all fields as required.
 * Might be fixed if we can turn on atrict null checks for the service, see
 * https://github.com/jquense/yup/issues/582
 */
type NoOptional<T> = { [K in keyof T]-?: T[K] };

export const yupBodyValidator = <T extends yup.Schema<any>>(
    s: T
): BodyValidator<NoOptional<yup.InferType<T>>> => (
    req: Request,
    res: Response,
    next: NextFunction
): req is Request & { body: yup.InferType<T> } => {
    s.validate(req.body, { strict: true, abortEarly: false })
        .then(() => next())
        .catch((err: yup.ValidationError) => {
            const errors = formatValidationErrors(err);
            logger.info(
                {
                    v2ValidationErrors: errors,
                    organizationId: req.user?.organizationId,
                    userId: req.user?.userId
                },
                "body validation errors"
            );
            res.status(400).send(errors);
        });

    return true;
};

export const yupQueryValidator = <T extends yup.Schema<any>>(
    s: T
): QueryValidator<yup.InferType<T>> => (
    req: Request,
    res: Response,
    next: NextFunction
): req is Request & { query: yup.InferType<T> } => {
    s.validate(req.query, { strict: true, abortEarly: false })
        .then(() => next())
        .catch(err => {
            const errors = formatValidationErrors(err);
            logger.info(
                {
                    v2ValidationErrors: errors,
                    organizationId: req.user?.organizationId,
                    userId: req.user?.userId
                },
                "query validation errors"
            );
            res.status(400).send(errors);
        });

    return true;
};

export const paramsValidator = <P extends string>(
    ...params: P[]
): ParamsValidator<Record<P, string>> => (
    req: Request,
    res: Response,
    next: NextFunction
): req is Request & { params: Record<P, string> } => {
    const missingParameters = params.filter(
        param => typeof req.params[param] !== "string"
    );

    if (missingParameters.length > 0) {
        logger.info(
            {
                v2ValidationErrors: { missingParameters },
                organizationId: req.user?.organizationId,
                userId: req.user?.userId
            },
            "params validation errors"
        );
        res.status(400).send({ missingParameters });
        return false;
    }

    next();
    return true;
};
