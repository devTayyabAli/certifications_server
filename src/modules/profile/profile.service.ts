import { Types } from "mongoose";
import { Profile } from "../../models/profile.model";
import { ApiError } from "../../utils/api-error";
import { UpdateProfileInput } from "./profile.validation";

export class ProfileService {
  static async getProfile(userId: Types.ObjectId) {
    let profile = await Profile.findOne({ user: userId });

    if (!profile) {
      profile = await Profile.create({
        user: userId,
        name: "",
        role: "",
        organization: "",
        socialLink: "",
        bio: "",
        photoUrl: null,
        prefilledFields: [],
      });
    }

    return profile;
  }

  static async updateProfile(userId: Types.ObjectId, updates: UpdateProfileInput) {
    let profile = await Profile.findOne({ user: userId });

    if (!profile) {
      profile = new Profile({ user: userId });
    }

    if (updates.name !== undefined) profile.name = updates.name;
    if (updates.role !== undefined) profile.role = updates.role;
    if (updates.organization !== undefined) profile.organization = updates.organization;
    if (updates.socialLink !== undefined) profile.socialLink = updates.socialLink;
    if (updates.bio !== undefined) profile.bio = updates.bio;
    if (updates.photoUrl !== undefined) profile.photoUrl = updates.photoUrl;

    await profile.save();
    return profile;
  }

  static async getPrefill(userId: Types.ObjectId) {
    const profile = await this.getProfile(userId);
    return {
      prefilledFields: profile.prefilledFields,
      name: profile.name,
      role: profile.role,
      organization: profile.organization,
    };
  }
}
