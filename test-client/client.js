const { io } = require("socket.io-client");

const SERVER_URL = "http://localhost:4000";

// Host socket
const socket = io(SERVER_URL, {
  transports: ["websocket"],
});

socket.on("connect", () => {
  console.log("✅ Connected as:", socket.id);

  socket.emit(
    "room:create",
    {
      name: "HostPlayer",
      password: "secret123",
      settings: { targetScore: 300, roundSeconds: 30 },
    },
    (res) => {
      console.log("📦 room:create response:", res);

      if (!res?.ok) {
        console.log("❌ Create failed. Exiting.");
        process.exit(1);
      }

      const roomCode = res.roomCode;

      // Second player socket
      const socket2 = io(SERVER_URL, { transports: ["websocket"] });

      socket2.on("connect", () => {
        console.log("✅ Player2 connected as:", socket2.id);

        socket2.on("room:state", (state) => {
          console.log("📡 Player2 room:state update:");
          console.log(JSON.stringify(state, null, 2));
        });

        socket2.emit(
          "room:join",
          { roomCode, name: "PlayerTwo", password: "secret123" },
          (joinRes) => {
            console.log("👤 room:join response (Player2):", joinRes);

            if (joinRes?.ok) {
              socket.emit("room:team:set", { roomCode, team: "blue" }, (r) => {
                console.log("🔵 Host set team:", r);
              });

              socket2.emit("room:team:set", { roomCode, team: "red" }, (r) => {
                console.log("🔴 Player2 set team:", r);
              });
            }
          }
        );
      });

      socket2.on("connect_error", (err) => {
        console.log("❌ Player2 connect error:", err.message);
      });
    }
  );
});

socket.on("room:state", (state) => {
  console.log("📡 Host room:state update:");
  console.log(JSON.stringify(state, null, 2));
});

socket.on("connect_error", (err) => {
  console.log("❌ Connect error:", err.message);
});
