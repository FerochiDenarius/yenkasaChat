import useChatComposer from "./useChatComposer";
import useChatData from "./useChatData";

export default function useChat(roomId) {
  const data = useChatData(roomId);
  const composer = useChatComposer({
    roomId,
    setMessages: data.setMessages,
    setRooms: data.setRooms,
    participant: data.participant,
  });

  return {
    ...data,
    ...composer,
  };
}
