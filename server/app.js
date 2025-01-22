import express from "express";
import dotenv from "dotenv";
import { connectDB } from "./utils/features.js";
import { errorMiddleware } from "./middlewares/error.js";
import cookieParser from "cookie-parser";
import cors from "cors";
import { Server } from "socket.io";
import { createServer } from "http";
import { v4 as uuid } from "uuid";
import { v2 as cloudinary } from "cloudinary";

import { NEW_MESSAGE, NEW_MESSAGE_ALERT } from "./constants/events.js";
import { getSockets } from "./lib/helper.js";
import { Message } from "./models/messageModel.js";
import { corsOptions } from "./constants/config.js";
import { socketAuth } from "./middlewares/authMiddleware.js";

import userRoute from "./routes/userRoutes.js";
import chatRoute from "./routes/chatRoutes.js";
import adminRoute from "./routes/adminRoutes.js";

dotenv.config({
  path: "./.env",
});

const port = process.env.PORT || 3000;
const mongoURI = process.env.MONGO_URI;
const envMode = process.env.NODE_ENV.trim() || "PRODUCTION";

const adminSecretKey =
  process.env.ADMIN_SECRET_KEY || "ufehgdkhfvjkmmithudhgfodgj";

const userSocketIDs = new Map();

connectDB(mongoURI);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: corsOptions,
});

app.set("io", io);

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

//console.log(process.env.PORT);

app.use("/api/v1/user", userRoute);
app.use("/api/v1/chat", chatRoute);
app.use("/api/v1/admin", adminRoute);

app.get("/", (req, res) => {
  res.send("Hello World");
});

io.use((socket, next) => {
  cookieParser()(
    socket.request,
    socket.request.res,
    async (err) => await socketAuth(err, socket, next)
  );
});

io.on("connection", (socket) => {
  const user = socket.user;
  //console.log(user);

  userSocketIDs.set(user._id.toString(), socket.id);

  //console.log("A user connected", socket.id);

  socket.on(NEW_MESSAGE, async ({ chatId, members, message }) => {
    const messageForRealTime = {
      content: message,
      _id: uuid(),
      sender: {
        _id: user._id,
        name: user.name,
      },
      chat: chatId,
      createdAt: new Date().toISOString(),
    };

    const messageForDB = {
      content: message,
      sender: user._id,
      chat: chatId,
    };

    const membersSockets = getSockets(members);

    io.to(membersSockets).emit(NEW_MESSAGE, {
      chatId,
      message: messageForRealTime,
    });

    io.to(membersSockets).emit(NEW_MESSAGE_ALERT, { chatId });

    try {
      await Message.create(messageForDB);
    } catch (error) {
      console.log(error);
    }
  });

  socket.on("START_TYPING", ({ chatId, members }) => {
    const membersSockets = getSockets(members);

    socket.to(membersSockets).emit("START_TYPING", { chatId });
  });

  socket.on("STOP_TYPING", ({ chatId, members }) => {
    const membersSockets = getSockets(members);

    socket.to(membersSockets).emit("STOP_TYPING", { chatId });
  });

  socket.on("disconnect", () => {
    //console.log("User disconnected");

    userSocketIDs.delete(user._id.toString());
  });
});

app.use(errorMiddleware);

server.listen(port, (req, res) => {
  console.log(`Server is running on port ${port} in ${envMode} Mode`);
});

export { adminSecretKey, envMode, userSocketIDs };
