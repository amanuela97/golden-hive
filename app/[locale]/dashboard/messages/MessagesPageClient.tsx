"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { getSocket } from "@/lib/socket-client";
import { format, isToday, isYesterday, differenceInDays } from "date-fns";
import Image from "next/image";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTitle,
} from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  Check,
  CheckCheck,
  MoreVertical,
  Trash2,
  MoreHorizontal,
  Ban,
  Unlock,
  Search,
  Smile,
  Paperclip,
  X,
  Download,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";

interface Message {
  id: string;
  text: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  mediaFileName?: string | null;
  senderId: string;
  senderRole: "customer" | "seller" | "admin";
  sender: { id: string; name: string; image: string | null };
  isDeleted: boolean;
  readBy?: string[];
  createdAt: Date;
  roomId?: string;
}

interface ChatRoom {
  id: string;
  orderId: string;
  storeId: string;
  buyerId: string;
  sellerId: string;
  status: "active" | "blocked" | "archived";
  buyerBlocked?: boolean;
  sellerBlocked?: boolean;
  buyerDeleted?: boolean;
  sellerDeleted?: boolean;
  blockedBy?: string | null;
  storeName: string;
  storeLogoUrl?: string | null;
  buyerName: string;
  buyerImage?: string | null;
  lastMessageAt: Date | null;
  lastMessagePreview: string | null;
}

export default function MessagesPageClient() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");

  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [searchInput, setSearchInput] = useState(""); // Input value (updates immediately)
  const [searchQuery, setSearchQuery] = useState(""); // Debounced search query (used for API)
  const [roomsPage, setRoomsPage] = useState(1);
  const [hasMoreRooms, setHasMoreRooms] = useState(true);
  const roomsListRef = useRef<HTMLDivElement>(null);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{
    file: File;
    preview?: string;
    mediaUrl?: string;
    mediaType?: string;
    mediaFileName?: string;
    publicId?: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const [viewingMedia, setViewingMedia] = useState<{
    url: string;
    type: string;
    fileName?: string;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastMessageRef = useRef<{ count: number; lastId: string | null }>({
    count: 0,
    lastId: null,
  });
  const socket = getSocket();

  // Note: Socket.io doesn't work in Next.js API routes, so we use REST API + polling
  // Set connected to true since REST API is always available
  useEffect(() => {
    setIsConnected(true);
    setConnectionError(null);
  }, []);

  // Get current user ID
  useEffect(() => {
    async function getCurrentUser() {
      try {
        const res = await fetch("/api/user/me");
        const data = await res.json();
        if (data.id) {
          setCurrentUserId(data.id);
        }
      } catch (error) {
        console.error("[Messages] Error fetching current user:", error);
      }
    }
    getCurrentUser();
  }, []);

  // Helper function to get initials from name
  const getInitials = (name: string): string => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Debounce search input
  useEffect(() => {
    // Clear existing timeout
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    // Set new timeout to update searchQuery after 500ms of no typing
    searchDebounceRef.current = setTimeout(() => {
      setSearchQuery(searchInput);
    }, 500);

    // Cleanup on unmount or when searchInput changes
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchInput]);

  // Load user's chat rooms (reset when debounced searchQuery or orderId changes)
  useEffect(() => {
    setRoomsPage(1);
    setRooms([]);
    
    async function loadRooms() {
      setIsLoadingRooms(true);
      try {
        const url = `/api/chat/rooms/list?page=1&limit=6${
          searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ""
        }`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.rooms) {
          setRooms(data.rooms);
          setHasMoreRooms(data.pagination?.hasMore || false);

          // If orderId is provided, select that room
          if (orderId) {
            const room = data.rooms.find((r: ChatRoom) => r.orderId === orderId);
            if (room && room.id !== selectedRoomId) {
              setSelectedRoomId(room.id);
            }
          } else if (data.rooms.length > 0 && !selectedRoomId) {
            // Select first room by default only if no room is selected
            setSelectedRoomId(data.rooms[0].id);
          }
        }
      } catch (error) {
        console.error("[Messages] Error loading rooms:", error);
      } finally {
        setIsLoadingRooms(false);
      }
    }

    loadRooms();
  }, [orderId, searchQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load more rooms on scroll
  useEffect(() => {
    const handleScroll = () => {
      if (!roomsListRef.current || isLoadingRooms || !hasMoreRooms) return;

      const { scrollTop, scrollHeight, clientHeight } = roomsListRef.current;
      // Load more when user is 100px from bottom
      if (scrollHeight - scrollTop - clientHeight < 100) {
        setRoomsPage((prev) => prev + 1);
      }
    };

    const listElement = roomsListRef.current;
    if (listElement) {
      listElement.addEventListener("scroll", handleScroll);
      return () => listElement.removeEventListener("scroll", handleScroll);
    }
  }, [isLoadingRooms, hasMoreRooms]);

  // Load more rooms when page changes
  useEffect(() => {
    if (roomsPage > 1 && !isLoadingRooms && hasMoreRooms) {
      async function loadMoreRooms() {
        try {
          const url = `/api/chat/rooms/list?page=${roomsPage}&limit=6${
            searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ""
          }`;
          const res = await fetch(url);
          const data = await res.json();

          if (data.rooms && data.rooms.length > 0) {
            setRooms((prev) => [...prev, ...data.rooms]);
            setHasMoreRooms(data.pagination?.hasMore || false);
          }
        } catch (error) {
          console.error("[Messages] Error loading more rooms:", error);
        }
      }
      loadMoreRooms();
    }
  }, [roomsPage, searchQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load messages when room is selected
  useEffect(() => {
    if (!selectedRoomId) return;

    // Reset last message tracking when room changes
    lastMessageRef.current = { count: 0, lastId: null };

    let pollingInterval: NodeJS.Timeout | null = null;

    async function loadMessages(isInitial = false) {
      // Only show loading skeleton on initial load
      if (isInitial) {
        setIsLoadingMessages(true);
      }
      
      try {
        const res = await fetch(`/api/chat/rooms?roomId=${selectedRoomId}`);
        const data = await res.json();

        if (data.messages) {
          // Only update if messages actually changed
          const currentMessageCount = data.messages.length;
          const currentLastMessageId =
            data.messages.length > 0
              ? data.messages[data.messages.length - 1].id
              : null;

          const hasNewMessages =
            currentMessageCount !== lastMessageRef.current.count ||
            currentLastMessageId !== lastMessageRef.current.lastId;

          if (hasNewMessages) {
            const hadNewMessage = currentLastMessageId !== lastMessageRef.current.lastId;
            setMessages(data.messages);
            lastMessageRef.current = {
              count: currentMessageCount,
              lastId: currentLastMessageId,
            };
            // Only scroll on initial load or if there's a new message
            if (isInitial || hadNewMessage) {
              scrollToBottom();
            }
          }
        }

        // Update room status if changed (only if status actually changed to avoid unnecessary updates)
        if (data.room) {
          setRooms((prev) => {
            const existingRoom = prev.find((r) => r.id === data.room.id);
            if (
              existingRoom &&
              existingRoom.status === data.room.status &&
              existingRoom.buyerBlocked === data.room.buyerBlocked &&
              existingRoom.sellerBlocked === data.room.sellerBlocked
            ) {
              return prev; // No change, return same array
            }
            return prev.map((r) =>
              r.id === data.room.id
                ? {
                    ...r,
                    status: data.room.status,
                    buyerBlocked: data.room.buyerBlocked,
                    sellerBlocked: data.room.sellerBlocked,
                    blockedBy: data.room.blockedBy,
                  }
                : r
            );
          });
        }
      } catch (error) {
        console.error("[Messages] Error loading messages:", error);
      } finally {
        if (isInitial) {
          setIsLoadingMessages(false);
        }
      }
    }

    // Load initial messages
    loadMessages(true);

    // Set up polling to check for new messages every 2 seconds
    pollingInterval = setInterval(() => loadMessages(false), 2000); // Poll every 2 seconds

    // Try to use socket if available (for future real-time support)
    if (socket.connected) {
      socket.emit("join-room", { roomId: selectedRoomId });

      const handleNewMessage = (message: Message) => {
        if (message.roomId === selectedRoomId || !message.roomId) {
          setMessages((prev) => {
            // Check if message already exists
            if (prev.some((msg) => msg.id === message.id)) {
              return prev;
            }
            return [...prev, message];
          });
          scrollToBottom();
        }
      };

      const handleMessageDeleted = ({ messageId }: { messageId: string }) => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId ? { ...msg, isDeleted: true } : msg
          )
        );
      };

      socket.on("new-message", handleNewMessage);
      socket.on("message-deleted", handleMessageDeleted);

      return () => {
        socket.off("new-message", handleNewMessage);
        socket.off("message-deleted", handleMessageDeleted);
        socket.emit("leave-room", { roomId: selectedRoomId });
        if (pollingInterval) {
          clearInterval(pollingInterval);
        }
      };
    }

    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [selectedRoomId]); // eslint-disable-line react-hooks/exhaustive-deps

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Handle file selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedRoomId) return;

    // Validate file size
    const fileType = file.type || "";
    let maxSize = 20 * 1024 * 1024; // 20MB default
    let fileCategory = "file";

    if (fileType.startsWith("image/")) {
      maxSize = 10 * 1024 * 1024; // 10MB
      fileCategory = "image";
    } else if (fileType.startsWith("video/")) {
      maxSize = 50 * 1024 * 1024; // 50MB
      fileCategory = "video";
    }

    if (file.size > maxSize) {
      const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(0);
      alert(
        `File size exceeds the maximum allowed size of ${maxSizeMB}MB for ${fileCategory}s. Please choose a smaller file.`
      );
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    // Create preview for images
    let preview: string | undefined;
    if (fileType.startsWith("image/")) {
      preview = URL.createObjectURL(file);
    }

    setSelectedFile({
      file,
      preview,
    });

    // Upload file immediately
    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("roomId", selectedRoomId);

      const response = await fetch("/api/chat/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to upload file");
      }

      const data = await response.json();
      setSelectedFile((prev) =>
        prev
          ? {
              ...prev,
              mediaUrl: data.mediaUrl,
              mediaType: data.mediaType,
              mediaFileName: data.mediaFileName,
              publicId: data.publicId,
            }
          : null
      );
    } catch (error) {
      console.error("[Messages] Error uploading file:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to upload file. Please try again.";
      alert(errorMessage);
      setSelectedFile(null);
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Handle emoji selection
  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setInputText((prev) => prev + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target as Node)
      ) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showEmojiPicker]);

  const sendMessage = async () => {
    if ((!inputText.trim() && !selectedFile) || !selectedRoomId) {
      return;
    }

    // Check if room is blocked
    const room = rooms.find((r) => r.id === selectedRoomId);
    if (room?.status === "blocked") {
      alert("You can no longer send messages in this chat.");
      return;
    }

    const messageText = inputText.trim();
    setInputText(""); // Clear input immediately for better UX

    // Always use REST API (Socket.io doesn't work in Next.js API routes)
    try {
      const response = await fetch("/api/chat/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roomId: selectedRoomId,
          text: messageText || null,
          mediaUrl: selectedFile?.mediaUrl || null,
          mediaType: selectedFile?.mediaType || null,
          mediaFileName: selectedFile?.mediaFileName || null,
          publicId: selectedFile?.publicId || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to send message");
      }

      const data = await response.json();
      if (data.message) {
        // Add message to local state immediately
        setMessages((prev) => {
          // Check if message already exists (avoid duplicates)
          if (prev.some((msg) => msg.id === data.message.id)) {
            return prev;
          }
          return [...prev, data.message];
        });
        scrollToBottom();

        // Optimistically update the room's last message in the list
        const preview = data.message.text
          ? data.message.text.substring(0, 100)
          : "[Media]";
        setRooms((prevRooms) =>
          prevRooms.map((room) =>
            room.id === selectedRoomId
              ? {
                  ...room,
                  lastMessageAt: new Date(data.message.createdAt),
                  lastMessagePreview: preview,
                }
              : room
          )
        );
      }

      // Refresh rooms list to get accurate data from server
      await refreshRooms();

      // Clear selected file
      if (selectedFile?.preview) {
        URL.revokeObjectURL(selectedFile.preview);
      }
      setSelectedFile(null);
    } catch (error) {
      console.error("[Messages] Error sending message:", error);
      alert("Failed to send message. Please try again.");
      setInputText(messageText); // Restore text on error
    }
  };

  // Memoize selectedRoom to prevent re-renders when rooms array changes during search
  // Only recalculate if selectedRoomId changes or if the selected room data actually changes
  const selectedRoom = useMemo(() => {
    if (!selectedRoomId) return undefined;
    const found = rooms.find((r) => r.id === selectedRoomId);
    // Return undefined if room not found (e.g., filtered out by search)
    return found;
  }, [selectedRoomId, rooms]);

  // Handle file download
  const handleDownload = async (url: string, fileName?: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = fileName || "download";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error("Error downloading file:", error);
      alert("Failed to download file. Please try again.");
    }
  };

  // Refresh rooms list
  const refreshRooms = async () => {
    try {
      const url = `/api/chat/rooms/list?page=1&limit=6${
        searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ""
      }`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.rooms) {
        // Preserve the selected room if it still exists in the new list
        const currentSelectedRoom = rooms.find((r) => r.id === selectedRoomId);
        setRooms(data.rooms);
        setHasMoreRooms(data.pagination?.hasMore || false);
        
        // If the selected room was removed (e.g., filtered by search), keep it selected
        // The selectedRoom memo will handle showing it even if filtered
        if (currentSelectedRoom && !data.rooms.find((r: ChatRoom) => r.id === selectedRoomId)) {
          // Room was filtered out but we want to keep it visible
          // The selectedRoom memo already handles this
        }
      }
    } catch (error) {
      console.error("[Messages] Error refreshing rooms:", error);
    }
  };

  // Delete message handler
  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm("Are you sure you want to delete this message?")) {
      return;
    }

    try {
      const res = await fetch(`/api/chat/messages/${messageId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete message");
      }

      // Update local state to mark message as deleted
      setMessages((prev) => {
        const updated = prev.map((msg) =>
          msg.id === messageId ? { ...msg, isDeleted: true } : msg
        );
        
        // Optimistically update the room's last message in the list
        const remainingMessages = updated.filter((msg) => !msg.isDeleted);
        const lastMsg = remainingMessages.length > 0
          ? remainingMessages.sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            )[0]
          : null;
        
        if (lastMsg && selectedRoomId) {
          const preview = lastMsg.text
            ? lastMsg.text.substring(0, 100)
            : "[Media]";
          setRooms((prevRooms) =>
            prevRooms.map((room) =>
              room.id === selectedRoomId
                ? {
                    ...room,
                    lastMessageAt: lastMsg.createdAt,
                    lastMessagePreview: preview,
                  }
                : room
            )
          );
        } else if (selectedRoomId) {
          // No more messages
          setRooms((prevRooms) =>
            prevRooms.map((room) =>
              room.id === selectedRoomId
                ? {
                    ...room,
                    lastMessageAt: null,
                    lastMessagePreview: null,
                  }
                : room
            )
          );
        }
        
        return updated;
      });

      // Refresh rooms list to get accurate data from server
      await refreshRooms();
    } catch (error) {
      console.error("[Messages] Error deleting message:", error);
      alert("Failed to delete message. Please try again.");
    }
  };

  // Check if current user has blocked this room
  const hasCurrentUserBlocked = (room: ChatRoom | undefined): boolean => {
    if (!room || !currentUserId) return false;
    if (room.buyerId === currentUserId) {
      return room.buyerBlocked || false;
    }
    if (room.sellerId === currentUserId) {
      return room.sellerBlocked || false;
    }
    return false;
  };

  // Block/unblock handler
  const handleBlockRoom = async () => {
    if (!selectedRoomId) return;

    try {
      const res = await fetch(`/api/chat/rooms/${selectedRoomId}/block`, {
        method: "POST",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to block chat");
      }

      // Reload rooms to get updated state
      const roomsRes = await fetch("/api/chat/rooms/list");
      const roomsData = await roomsRes.json();
      if (roomsData.rooms) {
        setRooms(roomsData.rooms);
      }
    } catch (error) {
      console.error("[Messages] Error blocking room:", error);
      alert("Failed to block chat. Please try again.");
    }
  };

  const handleUnblockRoom = async () => {
    if (!selectedRoomId) return;

    try {
      const res = await fetch(`/api/chat/rooms/${selectedRoomId}/block`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to unblock chat");
      }

      // Reload rooms to get updated state
      const roomsRes = await fetch("/api/chat/rooms/list");
      const roomsData = await roomsRes.json();
      if (roomsData.rooms) {
        setRooms(roomsData.rooms);
      }
    } catch (error) {
      console.error("[Messages] Error unblocking room:", error);
      alert("Failed to unblock chat. Please try again.");
    }
  };

  // Delete chat handler (soft delete - removes from user's view only)
  const handleDeleteChat = async () => {
    if (!selectedRoomId) return;

    if (
      !confirm(
        "Are you sure you want to delete this chat? It will be removed from your inbox, but the other person will still see it. If they send a new message, the chat will reappear."
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/chat/rooms/${selectedRoomId}/delete`, {
        method: "POST",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete chat");
      }

      // Remove from rooms list
      setRooms((prev) => prev.filter((room) => room.id !== selectedRoomId));
      
      // Clear selected room
      setSelectedRoomId(null);
      setMessages([]);
    } catch (error) {
      console.error("[Messages] Error deleting chat:", error);
      alert("Failed to delete chat. Please try again.");
    }
  };

  // Get read status for a message
  const getReadStatus = (message: Message): "sent" | "read" => {
    if (!currentUserId || message.senderId !== currentUserId) {
      return "sent"; // Not our message, no status
    }

    if (!message.readBy || message.readBy.length === 0) {
      return "sent"; // Single check - sent (not read yet)
    }

    // Check if the other participant has read it
    const selectedRoom = rooms.find((r) => r.id === selectedRoomId);
    if (!selectedRoom) return "sent";

    const otherUserId =
      currentUserId === selectedRoom.buyerId
        ? selectedRoom.sellerId
        : selectedRoom.buyerId;

    if (message.readBy.includes(otherUserId)) {
      return "read"; // Double check - read
    }

    return "sent"; // Single check - sent (not read by recipient yet)
  };

  // Format date separator (Today, Yesterday, or full date)
  const formatDateSeparator = (date: Date): string => {
    if (isToday(date)) {
      return "Today";
    } else if (isYesterday(date)) {
      return "Yesterday";
    } else {
      const daysDiff = differenceInDays(new Date(), date);
      if (daysDiff < 7) {
        return format(date, "EEEE"); // Day of week (Monday, Tuesday, etc.)
      } else {
        return format(date, "MMMM d, yyyy"); // Full date (January 11, 2026)
      }
    }
  };

  // Group messages by date
  const groupMessagesByDate = (messages: Message[]) => {
    const grouped: Array<{
      date: Date;
      dateLabel: string;
      messages: Message[];
    }> = [];
    let currentDate: Date | null = null;
    let currentGroup: Message[] = [];

    messages.forEach((msg) => {
      const msgDate = new Date(msg.createdAt);
      const msgDateStr = format(msgDate, "yyyy-MM-dd");

      if (!currentDate || format(currentDate, "yyyy-MM-dd") !== msgDateStr) {
        // New date group
        if (currentGroup.length > 0) {
          grouped.push({
            date: currentDate!,
            dateLabel: formatDateSeparator(currentDate!),
            messages: currentGroup,
          });
        }
        currentDate = msgDate;
        currentGroup = [msg];
      } else {
        currentGroup.push(msg);
      }
    });

    // Add the last group
    if (currentGroup.length > 0 && currentDate) {
      grouped.push({
        date: currentDate,
        dateLabel: formatDateSeparator(currentDate),
        messages: currentGroup,
      });
    }

    return grouped;
  };

  const groupedMessages = groupMessagesByDate(messages);

  return (
    <div className="flex h-[calc(100vh-8rem)] -m-6">
      {/* Sidebar - Room List */}
      <div className="w-80 border-r bg-gray-50 flex flex-col">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold mb-3">Messages</h2>
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search conversations..."
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
              }}
              className="pl-9"
            />
          </div>
        </div>
        <div
          ref={roomsListRef}
          className="flex-1 overflow-y-auto"
        >
          {isLoadingRooms && rooms.length === 0 ? (
            <div className="p-4 space-y-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {rooms.map((room) => {
                const isBuyer = currentUserId === room.buyerId;
                const otherUserImage = isBuyer
                  ? room.storeLogoUrl
                  : room.buyerImage;
                const otherUserName = isBuyer
                  ? room.storeName
                  : room.buyerName;
                const otherUserInitials = getInitials(otherUserName);

                return (
                  <button
                    key={room.id}
                    onClick={() => setSelectedRoomId(room.id)}
                    className={`w-full text-left p-4 border-b cursor-pointer flex items-center gap-3 transition-colors ${
                      selectedRoomId === room.id
                        ? "bg-blue-100 border-blue-300 border-l-4 border-l-blue-500 shadow-sm"
                        : "hover:bg-gray-100 border-gray-200"
                    }`}
                  >
                    {/* Avatar */}
                    <div className="flex-shrink-0 relative">
                      {otherUserImage ? (
                        <Image
                          src={otherUserImage}
                          alt={otherUserName}
                          width={48}
                          height={48}
                          className="rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold text-sm">
                          {otherUserInitials}
                        </div>
                      )}
                    </div>
                    {/* Room Info */}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {otherUserName}
                      </div>
                      {room.lastMessagePreview && (
                        <div className="text-sm text-gray-600 mt-1 truncate">
                          {room.lastMessagePreview}
                        </div>
                      )}
                      {room.status === "blocked" && (
                        <div className="text-xs text-red-500 mt-1">Blocked</div>
                      )}
                    </div>
                  </button>
                );
              })}
              {rooms.length === 0 && !isLoadingRooms && (
                <div className="p-4 text-center text-gray-500">
                  {searchQuery
                    ? "No conversations found"
                    : "No messages yet"}
                </div>
              )}
              {isLoadingRooms && rooms.length > 0 && (
                <div className="p-4 space-y-4">
                  {[1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-12 w-12 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-full" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedRoom ? (
          <>
            <div className="border-b p-4 flex items-center justify-between">
              <div className="flex-1 flex items-center gap-3">
                {(() => {
                  const isBuyer = currentUserId === selectedRoom.buyerId;
                  const otherUserImage = isBuyer
                    ? selectedRoom.storeLogoUrl
                    : selectedRoom.buyerImage;
                  const otherUserName = isBuyer
                    ? selectedRoom.storeName
                    : selectedRoom.buyerName;
                  const otherUserInitials = getInitials(otherUserName);

                  return (
                    <>
                      {/* Avatar */}
                      <div className="flex-shrink-0 relative">
                        {otherUserImage ? (
                          <Image
                            src={otherUserImage}
                            alt={otherUserName}
                            width={40}
                            height={40}
                            className="rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold text-sm">
                            {otherUserInitials}
                          </div>
                        )}
                      </div>
                      {/* Name and Status */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">{otherUserName}</h3>
                        {selectedRoom.status === "blocked" && (
                          <p className="text-sm text-red-500 mt-1">
                            You can no longer send messages in this chat.
                          </p>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger className="p-2 rounded-full hover:bg-gray-100 cursor-pointer">
                  <MoreHorizontal className="w-5 h-5 text-gray-600" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {hasCurrentUserBlocked(selectedRoom) ? (
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={handleUnblockRoom}
                    >
                      <Unlock className="w-4 h-4 mr-2" />
                      Unblock
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      className="cursor-pointer"
                      variant="destructive"
                      onClick={handleBlockRoom}
                    >
                      <Ban className="w-4 h-4 mr-2" />
                      Block
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    className="cursor-pointer"
                    variant="destructive"
                    onClick={handleDeleteChat}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete chat
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div
              className="flex-1 overflow-y-auto overflow-x-hidden p-4 bg-gradient-to-b from-gray-300 to-gray-200"
     
            >
              {isLoadingMessages ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className={`flex ${
                        i % 2 === 0 ? "justify-end" : "justify-start"
                      }`}
                    >
                      <Skeleton className="h-16 w-64 rounded-lg" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedRoom.status === "blocked" && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                      <p className="text-red-700 font-medium">
                        You can no longer send messages in this chat.
                      </p>
                    </div>
                  )}
                  {groupedMessages.map((group, groupIndex) => (
                  <div key={`group-${groupIndex}`}>
                    {/* Date Separator */}
                    <div className="flex items-center justify-center my-4">
                      <div className="bg-gray-200 text-gray-600 text-xs px-3 py-1 rounded-full">
                        {group.dateLabel}
                      </div>
                    </div>

                    {/* Messages for this date */}
                    {group.messages.map((msg) => {
                      const isOwnMessage = currentUserId === msg.senderId;
                      const readStatus = getReadStatus(msg);

                      return (
                        <div
                          key={msg.id}
                          className={`flex mb-4 group ${
                            msg.senderRole === "customer"
                              ? "justify-end"
                              : "justify-start"
                          }`}
                        >
                          <div
                            className={`relative max-w-xs lg:max-w-md px-4 py-2 rounded-lg break-words ${
                              msg.senderRole === "customer"
                                ? "bg-green-500 text-white"
                                : "bg-gray-200 text-gray-900"
                            }`}
                          >
                            {/* Menu button - top right */}
                            {!msg.isDeleted && isOwnMessage && (
                              <div className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <DropdownMenu >
                                  <DropdownMenuTrigger
                                    className={`p-1 rounded-full cursor-pointer hover:bg-opacity-80 ${
                                      msg.senderRole === "customer"
                                        ? "bg-green-600 text-white"
                                        : "bg-gray-300 text-gray-700"
                                    }`}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <MoreVertical className="w-4 h-4" />
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" >
                                    <DropdownMenuItem
                                    className="cursor-pointer"
                                      variant="destructive"
                                      onClick={() =>
                                        handleDeleteMessage(msg.id)
                                      }
                                    >
                                      <Trash2 className="w-4 h-4 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            )}

                            {msg.isDeleted ? (
                              <p className="italic text-gray-500">
                                This message was removed
                              </p>
                            ) : (
                              <>
                                <p className="text-sm font-semibold">
                                  {msg.sender.name}
                                </p>
                                {msg.text && (
                                  <p className="whitespace-pre-wrap break-words">
                                    {msg.text}
                                  </p>
                                )}
                                {msg.mediaUrl && (
                                  <div
                                    onClick={() =>
                                      setViewingMedia({
                                        url: msg.mediaUrl!,
                                        type: msg.mediaType || "image",
                                        fileName: msg.mediaFileName || undefined,
                                      })
                                    }
                                    className="mt-2 cursor-pointer"
                                  >
                                    {msg.mediaType === "image" ? (
                                      <Image
                                        width={300}
                                        height={300}
                                        src={msg.mediaUrl}
                                        alt="Media"
                                        className="rounded object-cover hover:opacity-90 transition-opacity max-w-sm"
                                      />
                                    ) : msg.mediaType === "video" ? (
                                      <div className="relative">
                                        <video
                                          src={msg.mediaUrl}
                                          className="rounded max-w-xs max-h-48"
                                          controls={false}
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 rounded">
                                          <div className="w-12 h-12 bg-white bg-opacity-80 rounded-full flex items-center justify-center">
                                            <svg
                                              className="w-6 h-6 text-gray-800 ml-1"
                                              fill="currentColor"
                                              viewBox="0 0 24 24"
                                            >
                                              <path d="M8 5v14l11-7z" />
                                            </svg>
                                          </div>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-2 p-3 bg-gray-100 rounded hover:bg-gray-200 transition-colors">
                                        <Paperclip className="w-5 h-5 text-gray-600" />
                                        <span className="text-sm font-medium truncate max-w-xs">
                                          {msg.mediaFileName || "File"}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                )}
                                <div className="flex items-center justify-end gap-1 mt-1">
                                  <p className="text-xs opacity-75">
                                    {format(new Date(msg.createdAt), "HH:mm")}
                                  </p>
                                  {/* Read status icons - only for own messages */}
                                  {isOwnMessage && (
                                    <span className="ml-1">
                                      {readStatus === "read" ? (
                                        <CheckCheck className="w-3.5 h-3.5 opacity-75 text-blue-500" />
                                      ) : (
                                        <Check className="w-3.5 h-3.5 opacity-75" />
                                      )}
                                    </span>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            <div className="border border-gray-400 rounded-lg p-4">
              {connectionError && (
                <div className="mb-2 p-2 bg-red-100 text-red-700 text-sm rounded">
                  {connectionError}
                </div>
              )}

              {/* File Preview */}
              {selectedFile && (
                <div className="mb-3 p-3 bg-gray-100 rounded-lg relative">
                  <button
                    onClick={() => {
                      if (selectedFile.preview) {
                        URL.revokeObjectURL(selectedFile.preview);
                      }
                      setSelectedFile(null);
                    }}
                    className="absolute top-2 right-2 p-1 rounded-full hover:bg-gray-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  {selectedFile.preview ? (
                    <div className="flex items-center gap-3">
                      <Image
                        src={selectedFile.preview}
                        alt="Preview"
                        width={60}
                        height={60}
                        className="rounded object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {selectedFile.file.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {(selectedFile.file.size / 1024).toFixed(1)} KB
                          {uploadingFile && " - Uploading..."}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gray-300 rounded flex items-center justify-center">
                        <Paperclip className="w-6 h-6 text-gray-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {selectedFile.file.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {(selectedFile.file.size / 1024).toFixed(1)} KB
                          {uploadingFile && " - Uploading..."}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2 items-end">
                {/* Emoji Picker Button */}
                <div className="relative" ref={emojiPickerRef}>
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    disabled={selectedRoom.status === "blocked" || !isConnected}
                    className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 transition-colors"
                  >
                    <Smile className="w-5 h-5 text-gray-600" />
                  </button>
                  {showEmojiPicker && (
                    <div className="absolute bottom-full right-0 mb-2 z-50">
                      <EmojiPicker
                        onEmojiClick={handleEmojiClick}
                        width={350}
                        height={400}
                      />
                    </div>
                  )}
                </div>

                {/* File Upload Button */}
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  disabled={
                    selectedRoom.status === "blocked" ||
                    !isConnected ||
                    uploadingFile
                  }
                  className="hidden"
                  accept="image/*,video/*,.pdf,.doc,.docx,.txt"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={
                    selectedRoom.status === "blocked" ||
                    !isConnected ||
                    uploadingFile
                  }
                  className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 transition-colors"
                >
                  <Paperclip className="w-5 h-5 text-gray-600" />
                </button>

                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Type a message..."
                  disabled={selectedRoom.status === "blocked" || !isConnected}
                  rows={3}
                  className="flex-1 px-4 py-3 border rounded-lg disabled:opacity-50 resize-none overflow-y-auto break-words"
                  style={{ minHeight: "60px", maxHeight: "120px" }}
                />
                <button
                  onClick={sendMessage}
                  disabled={
                    (!inputText.trim() && !selectedFile) ||
                    !isConnected ||
                    selectedRoom.status === "blocked" ||
                    uploadingFile
                  }
                  className="px-6 py-3 bg-blue-500 text-white rounded-lg disabled:opacity-50 hover:bg-blue-600 transition-colors"
                >
                  {uploadingFile ? "Uploading..." : "Send"}
                </button>
              </div>
              {!isConnected && (
                <p className="text-xs text-gray-500 mt-2">
                  Connecting to server...
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Select a conversation to start messaging
          </div>
        )}
      </div>

      {/* Media Viewer Modal */}
      {viewingMedia && (
        <Dialog open={!!viewingMedia} onOpenChange={(open) => !open && setViewingMedia(null)}>
          <DialogPortal>
            <DialogOverlay className="bg-black/70" />
            <DialogPrimitive.Content className="fixed top-[50%] left-[50%] z-50 w-full max-w-4xl translate-x-[-50%] translate-y-[-50%] p-0 bg-transparent border-none shadow-none outline-none">
              <DialogTitle className="sr-only">
                {viewingMedia.fileName || "Media Viewer"}
              </DialogTitle>
              <div className="relative w-full h-full flex items-center justify-center">
                {viewingMedia.type === "image" ? (
                  <Image
                    src={viewingMedia.url}
                    alt={viewingMedia.fileName || "Media"}
                    width={1200}
                    height={1200}
                    className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                    unoptimized
                  />
                ) : viewingMedia.type === "video" ? (
                  <video
                    src={viewingMedia.url}
                    controls
                    className="max-w-full max-h-[90vh] rounded-lg shadow-2xl"
                    autoPlay
                  />
                ) : (
                  <div className="bg-white rounded-lg p-8 max-w-md text-center shadow-2xl">
                    <Paperclip className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                    <p className="text-lg font-semibold mb-4">
                      {viewingMedia.fileName || "File"}
                    </p>
                    <div className="flex gap-3 justify-center">
                      <button
                        onClick={() =>
                          handleDownload(
                            viewingMedia.url,
                            viewingMedia.fileName
                          )
                        }
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </button>
                      <a
                        href={viewingMedia.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                      >
                        Open in new tab
                      </a>
                    </div>
                  </div>
                )}
                <div className="absolute top-4 right-4 flex gap-2">
                  <button
                    onClick={() =>
                      handleDownload(
                        viewingMedia.url,
                        viewingMedia.fileName
                      )
                    }
                    className="p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                    title="Download"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setViewingMedia(null)}
                    className="p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                    title="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </DialogPrimitive.Content>
          </DialogPortal>
        </Dialog>
      )}
    </div>
  );
}
