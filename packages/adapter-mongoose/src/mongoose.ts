import type { Model } from "mongoose";
import type {
	Adapter,
	InitializeAdapter,
	KeySchema,
	UserSchema,
	SessionSchema
} from "lucia";
import type { UserDoc, SessionDoc, KeyDoc } from "./docs.js";

export const DEFAULT_PROJECTION = {
	$__: 0,
	__v: 0,
	_doc: 0
};

export const mongooseAdapter = (models: {
	User: Model<UserDoc>;
	Session: Model<SessionDoc>;
	Key: Model<KeyDoc>;
}): InitializeAdapter<Adapter> => {
	const { User, Session, Key } = models;
	return (LuciaError) => {
		return {
			getUser: async (userId: string) => {
				const userDoc = await User.findById(userId, DEFAULT_PROJECTION).lean();
				if (!userDoc) return null;
				return transformUserDoc(userDoc);
			},
			setUser: async (user, key) => {
				if (key) {
					const refKeyDoc = await Key.findById(key.id, DEFAULT_PROJECTION);
					if (refKeyDoc) throw new LuciaError("AUTH_DUPLICATE_KEY_ID");
				}
				const userDoc = new User(createMongoValues(user));
				await userDoc.save();
				if (!key) return;
				try {
					const keyDoc = new Key(createMongoValues(key));
					await keyDoc.save();
				} catch (error) {
					await Key.findByIdAndDelete(user.id);
					if (
						error instanceof Error &&
						error.message.includes("E11000") &&
						error.message.includes("id")
					) {
						throw new LuciaError("AUTH_DUPLICATE_KEY_ID");
					}
					throw error;
				}
			},
			deleteUser: async (userId: string) => {
				await User.findByIdAndDelete(userId);
			},
			updateUser: async (userId, partialUser) => {
				await User.findByIdAndUpdate(userId, partialUser, {
					new: true,
					projection: DEFAULT_PROJECTION
				}).lean();
			},

			getSession: async (sessionId) => {
				const session = await Session.findById(
					sessionId,
					DEFAULT_PROJECTION
				).lean();
				if (!session) return null;
				return transformSessionDoc(session);
			},
			getSessionsByUserId: async (userId) => {
				const sessions = await Session.find(
					{
						user_id: userId
					},
					DEFAULT_PROJECTION
				).lean();
				return sessions.map((val) => transformSessionDoc(val));
			},
			setSession: async (session) => {
				const sessionDoc = new Session(createMongoValues(session));
				await sessionDoc.save();
			},
			deleteSession: async (sessionId) => {
				await Session.findByIdAndDelete(sessionId);
			},
			deleteSessionsByUserId: async (userId) => {
				await Session.deleteMany({
					user_id: userId
				});
			},
			updateSession: async (sessionId, partialUser) => {
				await Session.findByIdAndUpdate(sessionId, partialUser, {
					new: true,
					projection: DEFAULT_PROJECTION
				}).lean();
			},

			getKey: async (keyId) => {
				const keyDoc = await Key.findById(keyId, DEFAULT_PROJECTION).lean();
				if (!keyDoc) return null;
				return transformKeyDoc(keyDoc);
			},
			setKey: async (key) => {
				try {
					const keyDoc = new Key(createMongoValues(key));
					await Key.create(keyDoc);
				} catch (error) {
					if (
						error instanceof Error &&
						error.message.includes("E11000") &&
						error.message.includes("id")
					) {
						throw new LuciaError("AUTH_DUPLICATE_KEY_ID");
					}
					throw error;
				}
			},
			getKeysByUserId: async (userId) => {
				const keyDocs = await Key.find(
					{
						user_id: userId
					},
					DEFAULT_PROJECTION
				).lean();
				return keyDocs.map((val) => transformKeyDoc(val));
			},
			deleteKey: async (keyId) => {
				await Key.findByIdAndDelete(keyId);
			},
			deleteKeysByUserId: async (userId) => {
				await Key.deleteMany({
					user_id: userId
				});
			},
			updateKey: async (keyId, partialKey) => {
				await Key.findByIdAndUpdate(keyId, partialKey, {
					new: true,
					projection: DEFAULT_PROJECTION
				}).lean();
			}
		};
	};
};

export const createMongoValues = (object: Record<any, any>) => {
	return Object.fromEntries(
		Object.entries(object).map(([key, value]) => {
			if (key === "id") return ["_id", value];
			return [key, value];
		})
	);
};

export const transformUserDoc = (row: UserDoc): UserSchema => {
	delete row.__v;
	const { _id: id, ...attributes } = row;
	return {
		id,
		...attributes
	};
};

export const transformSessionDoc = (row: SessionDoc): SessionSchema => {
	delete row.__v;
	const { _id: id, ...attributes } = row;
	return {
		id,
		...attributes
	};
};

export const transformKeyDoc = (row: KeyDoc): KeySchema => {
	return {
		id: row._id,
		user_id: row.user_id,
		hashed_password: row.hashed_password ?? null
	};
};
