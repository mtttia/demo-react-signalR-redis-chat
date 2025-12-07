import {useEffect, useState} from "react";
import * as signalR from "@microsoft/signalr";

function App() {
    const [connection, setConnection] = useState<signalR.HubConnection | null>(null);
    const [messages, setMessages] = useState<string[]>([]);

    const [user, setUser] = useState("");
    const [room, setRoom] = useState("");
    const [joinedRoom, setJoinedRoom] = useState("");
    const [message, setMessage] = useState("");

    useEffect(() => {
        const apiUrl = import.meta.env.VITE_API_URL;

        const newConnection = new signalR.HubConnectionBuilder()
            .withUrl(`${apiUrl}/chathub`, {})
            .withAutomaticReconnect([0, 2000, 10000, 10000, 10000, 10000])
            .build();

        newConnection.onreconnecting((error) => {
            console.log(`Connessione persa, tentativo di riconnessione...`, error);
        });

        newConnection.onreconnected((connectionId) => {
            console.log(`Riconnesso! Nuovo Connection ID: ${connectionId}`);
            if (joinedRoom) {
                newConnection.invoke("JoinRoom", joinedRoom).catch(console.error);
            }
        });

        setConnection(newConnection);
    }, []);

    useEffect(() => {
        if (connection) {
            connection
                .start()
                .then(() => {
                    console.log("Connected!");
                    connection.off("ReceiveMessage");
                    connection.on("ReceiveMessage", (user, msg) => {
                        setMessages((prev) => [...prev, `${user}: ${msg}`]);
                    });
                })
                .catch((e) => console.error("Connection failed: ", e));
        }
    }, [connection]);

    const joinRoom = async () => {
        if (connection && room) {
            try {
                await connection.invoke("JoinRoom", room);
                setJoinedRoom(room);
                setMessages([]);
            } catch (e) {
                console.error("Join failed: ", e);
            }
        }
    };

    const sendMessage = async () => {
        if (connection && message && user && joinedRoom) {
            try {
                await connection.invoke("SendMessageToRoom", joinedRoom, user, message);
                setMessage("");
            } catch (e) {
                console.error("Send failed: ", e);
            }
        }
    };

    return (
        <div style={{padding: "20px"}}>
            <h1>Distributed SignalR Chat</h1>

            {!joinedRoom ? (
                <div>
                    <input placeholder="Enter Room Name" value={room} onChange={(e) => setRoom(e.target.value)} />
                    <button onClick={joinRoom}>Join Room</button>
                </div>
            ) : (
                <div>
                    <h3>Room: {joinedRoom}</h3>
                    <div style={{marginBottom: "10px"}}>
                        <input placeholder="User Name" value={user} onChange={(e) => setUser(e.target.value)} style={{marginRight: "10px"}} />
                        <input
                            placeholder="Message"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                        />
                        <button onClick={sendMessage}>Send</button>
                        <button onClick={() => setJoinedRoom("")} style={{marginLeft: "10px"}}>
                            Leave
                        </button>
                    </div>
                    <hr />
                    <ul>
                        {messages.map((m, i) => (
                            <li key={i}>{m}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

export default App;
