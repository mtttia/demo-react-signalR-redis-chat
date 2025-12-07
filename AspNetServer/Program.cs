using AspNetServer.Hubs;
using StackExchange.Redis;

var builder = WebApplication.CreateBuilder(args);

// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

var redisConnection = builder.Configuration.GetConnectionString("redis");

if (string.IsNullOrWhiteSpace(redisConnection))
{
    throw new InvalidOperationException("Redis connection string named 'redis' is not configured.");
}

builder.Services.AddSingleton<IConnectionMultiplexer>(sp =>
{
    var options = ConfigurationOptions.Parse(redisConnection, true);
    options.AbortOnConnectFail = false;
    return ConnectionMultiplexer.Connect(options);
});

builder.Services.AddSignalR()
    .AddStackExchangeRedis(redisConnection!, options =>
    {
        options.Configuration.ChannelPrefix = "MyApp";
    });

builder.Services.AddCors(options =>
{
    options.AddPolicy("SignalRPolicy", policy =>
    {
        policy.SetIsOriginAllowed(_ => true) 
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials(); 
    });
});

var app = builder.Build();

app.UseCors("SignalRPolicy");

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();
app.MapHub<ChatHub>("/chathub");

app.Run();
