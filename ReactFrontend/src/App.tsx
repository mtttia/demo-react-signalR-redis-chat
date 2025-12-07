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

    const styles = {
        container: {
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
            width: "100%",
            height: "100vh",
            display: "flex",
            flexDirection: "column",
            backgroundColor: "#ffffff",
            overflow: "hidden",
            margin: 0,
            padding: 0,
        },
        joinWrapper: {
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
            width: "100%",
        },
        joinCard: {
            background: "white",
            padding: "40px",
            borderRadius: "24px",
            boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            width: "90%",
            maxWidth: "400px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
        },
        header: {
            padding: "16px 24px",
            background: "#ffffff",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            zIndex: 10,
        },
        headerTitle: {
            margin: 0,
            fontSize: "1.25rem",
            fontWeight: "700",
            color: "#1e293b",
            display: "flex",
            alignItems: "center",
            gap: "8px",
        },
        messagesArea: {
            flex: 1,
            overflowY: "auto",
            padding: "20px 24px",
            background: "#f1f5f9",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
        },
        messageRow: {
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            maxWidth: "70%",
            minWidth: "200px",
            alignSelf: "flex-start",
            animation: "fadeIn 0.3s ease",
        },
        bubble: {
            background: "white",
            padding: "12px 18px",
            borderRadius: "0 16px 16px 16px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
            fontSize: "1rem",
            lineHeight: "1.5",
            color: "#334155",
            position: "relative",
            border: "1px solid #e2e8f0",
        },
        meta: {
            fontSize: "0.7rem",
            color: "#94a3b8",
            marginTop: "6px",
            marginLeft: "4px",
            fontFamily: "monospace",
        },
        footer: {
            padding: "24px",
            background: "white",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            boxShadow: "0 -4px 20px rgba(0,0,0,0.02)",
        },
        inputRow: {
            display: "flex",
            gap: "12px",
            alignItems: "center",
        },
        input: {
            padding: "14px 20px",
            borderRadius: "12px",
            border: "1px solid #cbd5e1",
            outline: "none",
            fontSize: "1rem",
            transition: "all 0.2s",
            flex: 1,
            backgroundColor: "#f8fafc",
        },
        button: {
            padding: "14px 32px",
            borderRadius: "12px",
            border: "none",
            background: "#2563eb",
            color: "white",
            fontWeight: "600",
            fontSize: "1rem",
            cursor: "pointer",
            transition: "background 0.2s",
            boxShadow: "0 4px 6px -1px rgba(37, 99, 235, 0.2)",
        },
        userInput: {
            width: "200px",
            padding: "8px 12px",
            fontSize: "0.9rem",
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
            background: "#f8fafc",
            color: "#64748b",
        },
    };

    return (
        <div style={styles.container}>
            {!joinedRoom ? (
                <div style={styles.joinWrapper}>
                    <div style={styles.joinCard}>
                        <div
                            style={{
                                width: "48px",
                                height: "48px",
                                background: "#dbeafe",
                                borderRadius: "12px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                margin: "0 auto",
                                color: "#2563eb",
                            }}>
                            <svg
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                            </svg>
                        </div>
                        <div>
                            <h2 style={{margin: "0 0 8px 0", color: "#0f172a", fontSize: "1.5rem"}}>Welcome Back</h2>
                            <p style={{margin: 0, color: "#64748b"}}>Enter a room name to sync</p>
                        </div>
                        <input
                            style={{...styles.input, backgroundColor: "white"}}
                            placeholder="Room Name"
                            value={room}
                            onChange={(e) => setRoom(e.target.value)}
                            autoFocus
                        />
                        <button style={{...styles.button, width: "100%", marginTop: "8px"}} onClick={joinRoom}>
                            Join Room
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    <div style={styles.header}>
                        <div style={styles.headerTitle}>
                            <span style={{color: "#2563eb"}}>#</span>
                            {joinedRoom}
                        </div>
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                fontSize: "0.85rem",
                                color: "#10b981",
                                fontWeight: "500",
                                background: "#ecfdf5",
                                padding: "6px 12px",
                                borderRadius: "20px",
                            }}>
                            <span style={{width: "8px", height: "8px", background: "currentColor", borderRadius: "50%"}}></span>
                            Delta Sync Active
                        </div>
                    </div>

                    <div style={styles.messagesArea}>
                        {messages.map((m, i) => (
                            <div key={m.id || i} style={styles.messageRow}>
                                <div style={styles.bubble}>
                                    <div style={{fontWeight: "700", fontSize: "0.85rem", color: "#2563eb", marginBottom: "4px"}}>{m.user}</div>
                                    {m.text}
                                </div>
                                <span style={styles.meta}>ID: {m.id}</span>
                            </div>
                        ))}
                    </div>

                    <div style={styles.footer}>
                        <div style={{maxWidth: "1200px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "12px"}}>
                            <div style={{display: "flex", alignItems: "center", gap: "10px"}}>
                                <span style={{fontSize: "0.9rem", color: "#64748b", fontWeight: "500"}}>Posting as:</span>
                                <input style={styles.userInput} placeholder="Username" value={user} onChange={(e) => setUser(e.target.value)} />
                            </div>
                            <div style={styles.inputRow}>
                                <input
                                    style={styles.input}
                                    placeholder="Type your message here..."
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                                    autoFocus
                                />
                                <button style={styles.button} onClick={sendMessage}>
                                    Send Message
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

export default App;
