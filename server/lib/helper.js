import { userSocketIDs } from "../app.js";

export const getOtherMember = (members, userId) => {
  return members.find((member) => member._id.toString() !== userId);
};

export const getSockets = (users = []) => {
  const sockets = users.map((user) => {
    return userSocketIDs.get(user._id.toString());
  });

  return sockets;
};
