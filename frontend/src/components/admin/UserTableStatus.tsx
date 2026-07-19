interface UserTableStatusProps {
    isLoading: boolean;
    pageError: string | null;
    loadingText: string;
}

export function UserTableStatus({
    isLoading,
    pageError,
    loadingText,
}: UserTableStatusProps) {
    if (isLoading) {
        return (
            <div className="py-10 text-sm text-color-text-secondary">
                {loadingText}
            </div>
        );
    }

    return (
        <div className="py-10 text-sm text-status-critical-text">
            {pageError}
        </div>
    );
}
