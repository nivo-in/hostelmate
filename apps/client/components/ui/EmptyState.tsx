type EmptyStateProps = {
  message: string;
};

export function EmptyState({ message }: EmptyStateProps) {
  return (
    <div className="flex justify-center items-center py-8">
      <p className="text-sm text-gray-400">{message}</p>
    </div>
  );
}
