import { FieldBlock } from "../../FieldTip";
import { useAIApiGenerator } from "./AIApiGeneratorContext";

export function SwaggerUpload() {
  const { swaggerText, setSwaggerText } = useAIApiGenerator();
  return (
    <FieldBlock
      tip="Paste Swagger 2.0 or OpenAPI 3.x as JSON or YAML. All paths and operations will be turned into Katalon API test code."
      label="Swagger"
      htmlFor="api-swagger"
    >
      <textarea
        id="api-swagger"
        className="input"
        value={swaggerText}
        onChange={(e) => setSwaggerText(e.target.value)}
        placeholder='{"openapi":"3.0.0","paths":{...}}'
        spellCheck={false}
        dir="ltr"
        style={{ minHeight: "12rem" }}
      />
    </FieldBlock>
  );
}
