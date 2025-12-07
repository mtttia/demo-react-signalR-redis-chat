var builder = DistributedApplication.CreateBuilder(args);

var redis = builder.AddRedis("redis");

var api = builder.AddProject<Projects.AspNetServer>("api")
    .WithReference(redis)
    .WithReplicas(2)
    .WithExternalHttpEndpoints();

var frontend = builder.AddNpmApp("frontend", "../ReactFrontend", scriptName: "dev")
    .WithReference(api)
    .WithEnvironment("VITE_API_URL", api.GetEndpoint("https"))
    .WithHttpEndpoint(env: "VITE_PORT")
    .WithExternalHttpEndpoints()
    .PublishAsDockerFile();

builder.Build().Run();
