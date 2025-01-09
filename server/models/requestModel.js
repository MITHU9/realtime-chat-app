import mongoose, { Schema, Types, model } from "mongoose";

const userSchema = new Schema(
  {
    status: {
      type: String,
      default: "Pending",
      enum: ["Pending", "Accepted", "rejected"],
    },
    sender: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiver: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Request = mongoose.models.Request || model("Request", userSchema);
