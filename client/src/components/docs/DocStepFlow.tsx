type Props = {
  steps: string[];
};

export function DocStepFlow({ steps }: Props) {
  return (
    <ol className="htu-steps" aria-label="Step-by-step workflow">
      {steps.map((step, i) => (
        <li key={step} className="htu-step-card">
          <span className="htu-step-num" aria-hidden="true">
            {i + 1}
          </span>
          <p className="htu-step-text">{step}</p>
        </li>
      ))}
    </ol>
  );
}
