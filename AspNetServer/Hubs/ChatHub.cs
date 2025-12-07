using System.Text.Json;
using Microsoft.AspNetCore.SignalR;
using StackExchange.Redis;

namespace AspNetServer.Hubs;

public class ChatHub : Hub
{
    private readonly IConnectionMultiplexer _redis;

    public ChatHub(IConnectionMultiplexer redis)
    {
        _redis = redis;
    }

    public async Task JoinRoom(string roomName, long lastMessageId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, roomName);

        await Clients.Group(roomName).SendAsync("ReceiveMessage",
            new ChatMessage(0, "System", $"{Context.ConnectionId} joined {roomName}"));

        // DELTA SYNC: Fetch missed messages from Redis
        if (lastMessageId >= 0)
        {
            var db = _redis.GetDatabase();
            var key = $"chat:room:{roomName}:history";

            var allHistory = await db.ListRangeAsync(key, 0, -1);

            var missedMessages = allHistory
                .Select(x => JsonSerializer.Deserialize<ChatMessage>((string)x!))
                .Where(m => m != null && m.Id > lastMessageId)
                .ToList();

            if (missedMessages.Any())
            {
                await Clients.Caller.SendAsync("LoadHistory", missedMessages);
            }
        }
    }

    public async Task SendMessageToRoom(string roomName, string user, string message)
    {
        var db = _redis.GetDatabase();
        var key = $"chat:room:{roomName}:history";

        long msgId = DateTime.UtcNow.Ticks;
        var chatMsg = new ChatMessage(msgId, user, message);
        var json = JsonSerializer.Serialize(chatMsg);

        var tran = db.CreateTransaction();
        _ = tran.ListRightPushAsync(key, json);
        _ = tran.ListTrimAsync(key, -500, -1);
        await tran.ExecuteAsync();

        await Clients.Group(roomName).SendAsync("ReceiveMessage", chatMsg);
    }
}
public record ChatMessage(long Id, string User, string Text);
