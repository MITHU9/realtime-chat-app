import { faker } from "@faker-js/faker";
import { User } from "../models/userModel.js";

const createUser = async (numUsers) => {
  try {
    const userPromise = [];

    for (let i = 0; i < numUsers; i++) {
      const tempUser = User.create({
        name: faker.person.fullName(),
        username: faker.internet.userName(),
        password: "password",
        bio: faker.lorem.sentence(10),
        avatar: {
          public_id: faker.system.fileName(),
          url: faker.image.avatar(),
        },
      });

      userPromise.push(tempUser);
    }

    await Promise.all(userPromise);

    console.log("Users created", numUsers);

    process.exit(1);
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
};

export { createUser };
