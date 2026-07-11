import argon2 from 'argon2';

export const hashPassword = async (plainPassword: string): Promise<string> => {
  return argon2.hash(plainPassword, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MB
    timeCost: 3,
    parallelism: 4,
  });
};

export const comparePassword = async (
  plainPassword: string,
  hashedPassword: string,
): Promise<boolean> => {
  return argon2.verify(hashedPassword, plainPassword);
};
