import { FieldBlock } from "../../FieldTip";
import { useAIApiGenerator } from "./AIApiGeneratorContext";

export function PostmanUpload() {
  const { postmanText, setPostmanText } = useAIApiGenerator();
  return (
    <FieldBlock
      tip="Paste a Postman Collection v2.1 JSON export. Requests are converted to Katalon WS tests and RequestObject paths."
      label="Postman collection"
      htmlFor="api-postman"
    >
      <textarea
        id="api-postman"
        className="input"
        value={postmanText}
        onChange={(e) => setPostmanText(e.target.value)}
        placeholder='{"info":{"schema":"..."},"item":[...]}'
        spellCheck={false}
        dir="ltr"
        style={{ minHeight: "12rem" }}
      />
    </FieldBlock>
  );
}
