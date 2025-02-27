import { useInputValidation } from "6pp";
import {
  Button,
  Dialog,
  DialogTitle,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import UserItem from "../shared/UserItem";
import { useDispatch, useSelector } from "react-redux";
import {
  useAvailableFriendsQuery,
  useNewGroupMutation,
} from "../../redux/api/api";
import { useAsyncMutation, useErrors } from "../../hooks/hook";
import { setIsNewGroup } from "../../redux/reducers/misc";
import toast from "react-hot-toast";

const NewGroup = () => {
  const groupName = useInputValidation("");

  const { isNewGroup } = useSelector((state) => state.misc);

  const dispatch = useDispatch();
  const { isError, isLoading, error, data } = useAvailableFriendsQuery();

  const [newGroup, isLoadingNewGroup] = useAsyncMutation(useNewGroupMutation);

  const [selectedMembers, setSelectedMembers] = useState([]);

  const errors = [
    {
      isError,
      error,
    },
  ];

  useErrors(errors);

  const selectMemberHandler = (id) => {
    // setMembers((prev) =>
    //   prev.map((user) =>
    //     user._id === id ? { ...user, isAdded: !user.isAdded } : user
    //   )
    // );

    setSelectedMembers((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };
  //console.log(selectedMembers);

  const submitHandler = () => {
    if (!groupName.value) return toast.error("Group name is required");

    if (selectedMembers.length < 2)
      return toast.error("Please Select Atleast 3 Members");

    newGroup("Creating New Group...", {
      name: groupName.value,
      members: selectedMembers,
    });

    closeHandler();
  };

  const closeHandler = () => {
    dispatch(setIsNewGroup(false));
  };

  return (
    <Dialog onClose={closeHandler} open={isNewGroup}>
      <DialogTitle
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        New Group
      </DialogTitle>
      <Stack
        p={{ xs: "1rem", sm: "3rem" }}
        direction={"column"}
        width={"25rem"}
        spacing={2}
      >
        <TextField
          value={groupName.value}
          onChange={groupName.changeHandler}
          label="Group Name"
          variant="outlined"
          size="small"
          fullWidth
        />

        <Typography textAlign={"center"}>Select Members</Typography>

        <Stack>
          {isLoading ? (
            <Skeleton />
          ) : (
            data?.friends?.map((user, idx) => (
              <UserItem
                key={idx}
                user={user}
                handler={selectMemberHandler}
                isAdded={selectedMembers.includes(user._id)}
              />
            ))
          )}
        </Stack>

        <Stack
          direction={"row"}
          alignItems={"center"}
          justifyContent={"space-evenly"}
          spacing={2}
        >
          <Button variant={"outlined"} color="error" onClick={closeHandler}>
            Cancel
          </Button>
          <Button
            variant={"contained"}
            onClick={submitHandler}
            disabled={isLoadingNewGroup}
          >
            Create
          </Button>
        </Stack>
      </Stack>
    </Dialog>
  );
};
export default NewGroup;
