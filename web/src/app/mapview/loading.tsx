import { getRequestTranslationMessages } from '@/lib/server-language';

export default async function MapLoading() {
  const { messages } = await getRequestTranslationMessages();

  return (
    <div className="flex h-screen w-full items-center justify-center bg-gray-100">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
        <p className="text-sm text-gray-500">{messages.appShell.loadingMap}</p>
      </div>
    </div>
  );
}
