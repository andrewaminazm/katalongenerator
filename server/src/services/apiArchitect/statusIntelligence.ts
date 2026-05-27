import type { ApiEndpointSpec } from "../apiCodeGenerator/types.js";

export function inferSuccessStatus(ep: ApiEndpointSpec): number {
  const explicit = (ep as { successStatus?: number }).successStatus;
  if (explicit) return explicit;

  if (ep.method === "POST" && !/login|auth/i.test(ep.path)) return 201;
  if (ep.method === "DELETE") return 204;
  return 200;
}

export function inferValidationErrorStatuses(): number[] {
  return [400, 422];
}

export function inferAuthErrorStatuses(): number[] {
  return [401, 403];
}

export function inferNegativeStatuses(ep: ApiEndpointSpec, kind: "validation" | "auth" | "notFound"): number[] {
  const custom = (ep as { errorStatuses?: number[] }).errorStatuses;
  if (custom?.length) {
    if (kind === "auth") return custom.filter((c) => c === 401 || c === 403).length ? custom.filter((c) => c === 401 || c === 403) : inferAuthErrorStatuses();
    if (kind === "validation") return custom.filter((c) => c >= 400 && c < 500 && c !== 401 && c !== 403).length ? custom.filter((c) => c >= 400 && c < 500 && c !== 401 && c !== 403) : inferValidationErrorStatuses();
  }
  if (kind === "auth") return inferAuthErrorStatuses();
  if (kind === "validation") return inferValidationErrorStatuses();
  return [404, 400];
}

export function statusAssertionPostman(codes: number[]): string[] {
  if (codes.length === 1) {
    return [
      `pm.test("Status code is ${codes[0]}", function () {`,
      `    pm.response.to.have.status(${codes[0]});`,
      "});",
    ];
  }
  const list = codes.join(", ");
  return [
    `pm.test("Status is one of [${list}]", function () {`,
    `    pm.expect(pm.response.code).to.be.oneOf([${list}]);`,
    "});",
  ];
}
