import {
  ALERT,
  NEW_MESSAGE,
  NEW_MESSAGE_ALERT,
  REFETCH_CHATS,
} from "../constants/events.js";
import { getOtherMember } from "../lib/helper.js";
import { TryCatch } from "../middlewares/error.js";
import { Chat } from "../models/chatModel.js";
import {
  deleteFilesFromCloudinary,
  emitEvent,
  uploadFilesToCloudinary,
} from "../utils/features.js";
import { Errorhandler } from "../utils/utility.js";
import { User } from "../models/userModel.js";
import { Message } from "../models/messageModel.js";

const newGroupChat = TryCatch(async (req, res) => {
  const { name, members } = req.body;

  const allMembers = [...members, req.user];

  await Chat.create({
    name,
    groupChat: true,
    creator: req.user,
    members: allMembers,
  });

  emitEvent(req, ALERT, allMembers, `Welcome to ${name} group chat`);
  emitEvent(req, REFETCH_CHATS, members);

  res.status(200).json({
    success: true,
    message: "Group created successfully",
  });
});

const getMyChats = TryCatch(async (req, res) => {
  const chats = await Chat.find({ members: req.user }).populate(
    "members",
    "name avatar"
  );

  const transformedChats = chats.map(({ _id, name, members, groupChat }) => {
    const otherMember = getOtherMember(members, req.user);

    return {
      _id,
      groupChat,
      name: groupChat ? name : otherMember.name,
      avatar: groupChat
        ? members.slice(0, 3).map(({ avatar }) => avatar.url)
        : [otherMember.avatar.url],

      members: members.reduce((prev, curr) => {
        if (curr._id.toString() !== req.user.toString()) {
          prev.push(curr._id);
        }

        return prev;
      }, []),
    };
  });

  res.status(200).json({
    success: true,
    chats: transformedChats,
  });
});

const getMyGroups = TryCatch(async (req, res, next) => {
  const chats = await Chat.find({
    members: req.user,
    groupChat: true,
    creator: req.user,
  }).populate("members", "name avatar");

  const groups = chats.map(({ _id, name, members, groupChat }) => ({
    _id,
    name,
    groupChat,
    avatar: members.slice(0, 3).map(({ avatar }) => avatar.url),
  }));

  res.status(200).json({
    success: true,
    groups,
  });
});

const addMembers = TryCatch(async (req, res, next) => {
  const { chatId, members } = req.body;

  const chat = await Chat.findById(chatId);

  if (!chat) {
    return next(new Errorhandler("Chat not found", 404));
  }

  if (!chat.groupChat) {
    return next(new Errorhandler("This is not a group chat", 400));
  }

  if (chat.creator.toString() !== req.user.toString()) {
    return next(new Errorhandler("You are not allowed to add members", 403));
  }

  const allNewMembersPromise = members.map((member) =>
    User.findById(member, "name ")
  );

  const allNewMembers = await Promise.all(allNewMembersPromise);

  const uniqueMembers = allNewMembers
    .filter((member) => !chat.members.includes(member._id.toString()))
    .map(({ _id }) => _id);

  chat.members.push(...uniqueMembers);

  if (chat.members.length > 100) {
    return next(new Errorhandler("Group members limit reached", 400));
  }

  await chat.save();

  const allUsersName = allNewMembers.map(({ name }) => name).join(", ");

  emitEvent(
    req,
    ALERT,
    chat.members,
    `${allUsersName} has been added to the group`
  );

  emitEvent(req, REFETCH_CHATS, chat.members);

  res.status(200).json({
    success: true,
    message: "Members added successfully",
  });
});

const removeMember = TryCatch(async (req, res, next) => {
  const { userId, chatId } = req.body;

  const [chat, user] = await Promise.all([
    Chat.findById(chatId),
    User.findById(userId, "name"),
  ]);

  if (!chat) {
    return next(new Errorhandler("Chat not found", 404));
  }

  if (!chat.groupChat) {
    return next(new Errorhandler("This is not a group chat", 400));
  }

  if (chat.creator.toString() !== req.user.toString()) {
    return next(new Errorhandler("You are not allowed to remove members", 403));
  }

  if (chat.members.length <= 3) {
    return next(new Errorhandler("Group must have at least 3 members", 400));
  }

  const allChatMembers = chat.members.map((member) => member.toString());

  // const index = chat.members.indexOf(userId);

  // if (index === -1) {
  //   return next(new Errorhandler("User not found", 404));
  // }

  // chat.members.splice(index, 1);

  chat.members = chat.members.filter(
    (member) => member.toString() !== userId.toString()
  );

  await chat.save();

  emitEvent(req, ALERT, chat.members, {
    message: `${user.name} has been removed from the group`,
    chatId,
  });

  emitEvent(req, REFETCH_CHATS, allChatMembers);

  res.status(200).json({
    success: true,
    message: "Member removed successfully",
  });
});

const leaveGroup = TryCatch(async (req, res, next) => {
  const chatId = req.params.id;

  const chat = await Chat.findById(chatId);

  if (!chat) {
    return next(new Errorhandler("Chat not found", 404));
  }

  if (!chat.groupChat) {
    return next(new Errorhandler("This is not a group chat", 400));
  }

  const remainingMembers = chat.members.filter(
    (member) => member.toString() !== req.user.toString()
  );

  if (remainingMembers.length < 3) {
    return next(new Errorhandler("Group must have at least 3 members", 400));
  }

  if (chat.creator.toString() === req.user.toString()) {
    const randomIndex = Math.floor(Math.random() * remainingMembers.length);

    chat.creator = remainingMembers[randomIndex];
  }

  chat.members = remainingMembers;

  // const user = await User.findById(req.user, "name");

  const [user] = await Promise.all([
    User.findById(req.user, "name"),
    chat.save(),
  ]);

  emitEvent(req, ALERT, chat.members, {
    message: `${user.name} has left the group`,
    chatId,
  });

  res.status(200).json({
    success: true,
    message: "You have left the group",
  });
});

const sendAttachments = TryCatch(async (req, res, next) => {
  const { chatId } = req.body;

  //console.log(chatId);

  const files = req.files || [];

  //console.log(files);

  if (files.length > 5) {
    return next(new Errorhandler("You can only upload 5 files at a time", 400));
  }

  const [chat, user] = await Promise.all([
    Chat.findById(chatId),
    User.findById(req.user, "name "),
  ]); //The Promise.all() method takes an iterable of promises as an input, and returns a single Promise that resolves to an array of the results of the input promises.

  if (!chat) {
    return next(new Errorhandler("Chat not found", 404));
  }

  if (files.length === 0) {
    return next(new Errorhandler("Select files to send", 400));
  }

  //upload files to cloudinary
  const attachments = await uploadFilesToCloudinary(files);

  const messageForDB = {
    content: "",
    attachments,
    sender: user._id,
    chat: chatId,
  };

  const messageForRealTime = {
    ...messageForDB,
    sender: {
      _id: user._id,
      name: user.name,
    },
  };

  const message = await Message.create(messageForDB);

  emitEvent(req, NEW_MESSAGE, chat.members, {
    message: messageForRealTime,
    chatId,
  });

  emitEvent(req, NEW_MESSAGE_ALERT, chat.members, { chatId });

  return res.status(200).json({
    success: true,
    message,
  });
});

const getChatDetails = TryCatch(async (req, res, next) => {
  if (req.query.populate === "true") {
    const chat = await Chat.findById(req.params.id)
      .populate("members", "name avatar")
      .lean(); //lean() method is used to convert the mongoose document into a plain JavaScript object.

    if (!chat) {
      return next(new Errorhandler("Chat not found", 404));
    }

    chat.members = chat.members.map(({ _id, name, avatar }) => ({
      _id,
      name,
      avatar: avatar.url,
    }));

    return res.status(200).json({
      success: true,
      chat,
    });
  } else {
    const chat = await Chat.findById(req.params.id);

    if (!chat) {
      return next(new Errorhandler("Chat not found", 404));
    }

    return res.status(200).json({
      success: true,
      chat,
    });
  }
});

const renameGroup = TryCatch(async (req, res, next) => {
  const chatId = req.params.id;
  const { name } = req.body;

  const chat = await Chat.findById(chatId);

  if (!chat) {
    return next(new Errorhandler("Chat not found", 404));
  }

  if (!chat.groupChat) {
    return next(new Errorhandler("This is not a group chat", 400));
  }

  if (chat.creator.toString() !== req.user.toString()) {
    return next(
      new Errorhandler("You are not allowed to rename the group", 403)
    );
  }

  chat.name = name;

  await chat.save();

  emitEvent(req, REFETCH_CHATS, chat.members);

  res.status(200).json({
    success: true,
    message: "Group renamed successfully",
  });
});

const deleteChat = TryCatch(async (req, res, next) => {
  const chatId = req.params.id;

  const chat = await Chat.findById(chatId);

  if (!chat) {
    return next(new Errorhandler("Chat not found", 404));
  }

  const members = chat.members;

  if (chat.groupChat && chat.creator.toString() !== req.user.toString()) {
    return next(
      new Errorhandler("You are not allowed to delete the chat", 403)
    );
  }

  if (!chat.groupChat && !chat.members.includes(req.user.toString())) {
    return next(
      new Errorhandler("You are not allowed to delete the chat ", 403)
    );
  }

  const messagesWithAttachments = await Message.find({
    chat: chatId,
    attachments: { $exists: true, $ne: [] },
  });

  const public_ids = [];

  messagesWithAttachments.forEach(({ attachments }) => {
    attachments.forEach(({ public_id }) => {
      public_ids.push(public_id);
    });
  });

  await Promise.all([
    deleteFilesFromCloudinary(public_ids),
    chat.deleteOne(),
    Message.deleteMany({ chat: chatId }),
  ]);

  emitEvent(req, REFETCH_CHATS, chat.members);

  res.status(200).json({
    success: true,
    message: "Chat deleted successfully",
  });
});

const getMessages = TryCatch(async (req, res, next) => {
  const chatId = req.params.id;

  const { page = 1 } = req.query;

  const limit = 20;
  const skip = (page - 1) * limit;

  const chat = await Chat.findById(chatId);

  if (!chat) {
    return next(new Errorhandler("Chat not found", 404));
  }

  if (!chat.members.includes(req.user.toString())) {
    return next(new Errorhandler("You are not a member of this chat", 403));
  }

  const [messages, totalMessageCount] = await Promise.all([
    Message.find({ chat: chatId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("sender", "name")
      .lean(),

    Message.countDocuments({ chat: chatId }),
  ]);

  const totalPages = Math.ceil(totalMessageCount / limit);

  return res.status(200).json({
    success: true,
    messages: messages.reverse(),
    totalPages,
  });
});

export {
  newGroupChat,
  getMyChats,
  getMyGroups,
  addMembers,
  removeMember,
  leaveGroup,
  sendAttachments,
  getChatDetails,
  renameGroup,
  deleteChat,
  getMessages,
};
