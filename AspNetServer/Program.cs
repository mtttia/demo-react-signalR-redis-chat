using AspNetServer.Hubs;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

var redisConnection = builder.Configuration.GetConnectionString("redis");

builder.Services.AddSignalR()
    .AddStackExchangeRedis(redisConnection!, options =>
    {
        options.Configuration.ChannelPrefix = "MyApp";
    });

builder.Services.AddCors(options =>
{
    options.AddPolicy("SignalRPolicy", policy =>
    {
        policy.SetIsOriginAllowed(_ => true) // Allow any origin (dev only)
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials(); // Required for SignalR
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
