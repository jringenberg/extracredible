interface ProgressBarProps {
  progress: number;
  message: string;
}

export function ProgressBar({ progress, message }: ProgressBarProps) {
  return (
    <div className="progress-container">
      <p className="progress-message">{message}</p>
      <div className="progress-bar-bg">
        <div
          className="progress-bar-fill"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
    </div>
  );
}
