import {useEffect, useState, useRef} from "react";
import * as signalR from "@microsoft/signalr";

interface ChatMessage {
    id: number;
    user: string;
    text: string;
}

function App() {
    const [connection, setConnection] = useState<signalR.HubConnection | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);

    // State
    const [user, setUser] = useState("");
    const [room, setRoom] = useState("");
    const [joinedRoom, setJoinedRoom] = useState("");
    const [message, setMessage] = useState("");

    // Tracking the last ID for Sync (Use Ref to access inside closures/callbacks)
    const lastIdRef = useRef<number>(0);

    useEffect(() => {
        const apiUrl = import.meta.env.VITE_API_URL;

        const newConnection = new signalR.HubConnectionBuilder()
            .withUrl(`${apiUrl}/chathub`, {
                skipNegotiation: true,
                transport: signalR.HttpTransportType.WebSockets,
            })
            .withAutomaticReconnect()
            .build();

        // 1. Real-time Message Handler
        newConnection.on("ReceiveMessage", (msg: ChatMessage) => {
            setMessages((prev) => {
                // Avoid duplicates if weird race conditions happen
                if (prev.some((m) => m.id === msg.id && msg.id !== 0)) return prev;
                return [...prev, msg];
            });

            // Update cursor only for real user messages (id > 0)
            if (msg.id > 0) {
                lastIdRef.current = msg.id;
            }
        });

        // 2. History Sync Handler (Batch insert)
        newConnection.on("LoadHistory", (missedMessages: ChatMessage[]) => {
            console.log(`Syncing ${missedMessages.length} missed messages...`);
            setMessages((prev) => {
                // Merge and Sort
                const combined = [...prev, ...missedMessages];
                // Remove duplicates by ID
                const unique = Array.from(new Map(combined.map((m) => [m.id, m])).values());
                return unique.sort((a, b) => a.id - b.id);
            });

            // Update cursor to the latest
            if (missedMessages.length > 0) {
                const maxId = Math.max(...missedMessages.map((m) => m.id));
                if (maxId > lastIdRef.current) lastIdRef.current = maxId;
            }
        });

        // 3. Reconnection Logic
        newConnection.onreconnected(() => {
            console.log("Reconnected! Syncing...");
            if (joinedRoom) {
                // Pass the Last ID we have to fill the gap
                newConnection.invoke("JoinRoom", joinedRoom, lastIdRef.current).catch(console.error);
            }
        });

        setConnection(newConnection);
    }, [joinedRoom]); // Re-create listener if room changes (optional optimization)

    useEffect(() => {
        if (connection && connection.state === signalR.HubConnectionState.Disconnected) {
            connection
                .start()
                .then(() => console.log("Connected!"))
                .catch(console.error);
        }
    }, [connection]);

    const joinRoom = async () => {
        if (connection && room) {
            // Reset state for new room
            setMessages([]);
            lastIdRef.current = 0;

            await connection.invoke("JoinRoom", room, 0);
            setJoinedRoom(room);
        }
    };

    const sendMessage = async () => {
        if (connection && message && user && joinedRoom) {
            await connection.invoke("SendMessageToRoom", joinedRoom, user, message);
            setMessage("");
        }
    };

    return (
        <div style={{padding: "20px"}}>
            <h1>Distributed Chat (Delta Sync)</h1>
            {!joinedRoom ? (
                <div>
                    <input placeholder="Room" value={room} onChange={(e) => setRoom(e.target.value)} />
                    <button onClick={joinRoom}>Join</button>
                </div>
            ) : (
                <div>
                    <h3>Room: {joinedRoom}</h3>
                    <input placeholder="User" value={user} onChange={(e) => setUser(e.target.value)} />
                    <input
                        placeholder="Msg"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                    />
                    <button onClick={sendMessage}>Send</button>
                    <hr />
                    <ul>
                        {messages.map((m, i) => (
                            <li key={m.id || i}>
                                <b>{m.user}:</b> {m.text} <small style={{fontSize: "0.8em", color: "#999"}}>({m.id})</small>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

export default App;
