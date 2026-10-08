import { Types } from "mongoose";
import { Settings } from "../../models/settings.model";
import { UpdateSettingsInput } from "./settings.validation";

export class SettingsService {
  static async getSettings(userId: Types.ObjectId) {
    let settings = await Settings.findOne({ user: userId });
    if (!settings) {
      settings = await Settings.create({ user: userId });
    }
    return {
      emailNotifications: settings.emailNotifications,
      onChainVerificationPrivacy: settings.onChainVerificationPrivacy,
    };
  }

  static async updateSettings(userId: Types.ObjectId, updates: UpdateSettingsInput) {
    let settings = await Settings.findOne({ user: userId });
    if (!settings) {
      settings = new Settings({ user: userId });
    }

    if (updates.emailNotifications !== undefined) {
      settings.emailNotifications = updates.emailNotifications;
    }
    if (updates.onChainVerificationPrivacy !== undefined) {
      settings.onChainVerificationPrivacy = updates.onChainVerificationPrivacy;
    }

    await settings.save();

    return {
      emailNotifications: settings.emailNotifications,
      onChainVerificationPrivacy: settings.onChainVerificationPrivacy,
    };
  }
}
