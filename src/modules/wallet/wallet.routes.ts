import { Router } from "express";
import { authenticateJwt } from "../../middlewares/auth.middleware";
import { validateRequest } from "../../middlewares/validate.middleware";
import { WalletController } from "./wallet.controller";
import { connectWalletSchema } from "./wallet.validation";

const router = Router();

router.use(authenticateJwt);

router.post("/nonce", WalletController.getNonce);
router.post("/connect", validateRequest({ body: connectWalletSchema }), WalletController.connect);
router.delete("/disconnect", WalletController.disconnect);
router.get("/status", WalletController.getStatus);

export const walletRoutes = router;
