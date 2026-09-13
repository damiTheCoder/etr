import * as React from "react";
import { Message, ChatMessageList, AiChatEmptyState } from "@/components/ui/chat";

export interface MessagesProps {
  messages: Message[];
  isLoading?: boolean;
  onRegenerate?: () => void;
  onSelectSuggestion?: (prompt: string) => void;
}

export const Messages: React.FC<MessagesProps> = ({
  messages,
  isLoading = false,
  onRegenerate,
  onSelectSuggestion,
}) => {
  if (messages.length === 0 && !isLoading) {
    return (
      <AiChatEmptyState
        onSelectSuggestion={(prompt) => onSelectSuggestion?.(prompt)}
      />
    );
  }

  return (
    <ChatMessageList
      messages={messages}
      isLoading={isLoading}
      onRegenerate={onRegenerate}
    />
  );
};
