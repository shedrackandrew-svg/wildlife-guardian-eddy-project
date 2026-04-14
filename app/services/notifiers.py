from __future__ import annotations

import json
import logging

from app.config import get_settings

logger = logging.getLogger(__name__)


class NotificationDispatcher:
    def __init__(self) -> None:
        self.settings = get_settings()

    async def dispatch(self, message: str, channels: list[str]) -> list[dict[str, str]]:
        results: list[dict[str, str]] = []
        for channel in channels:
            if channel == "console":
                logger.warning("ALERT: %s", message)
                results.append({"channel": "console", "status": "sent"})
            elif channel == "sms":
                results.append(await self._send_sms(message))
            elif channel == "gsm":
                results.append(await self._send_gsm(message))
            elif channel == "lora":
                results.append(await self._send_lora(message))
            else:
                results.append({"channel": channel, "status": "unsupported"})
        return results

    async def _send_sms(self, message: str) -> dict[str, str]:
        if not self.settings.enable_sms:
            return {"channel": "sms", "status": "disabled"}

        if not all([
            self.settings.twilio_account_sid,
            self.settings.twilio_auth_token,
            self.settings.twilio_from,
            self.settings.sms_to,
        ]):
            return {"channel": "sms", "status": "missing_credentials"}

        try:
            from twilio.rest import Client

            client = Client(self.settings.twilio_account_sid, self.settings.twilio_auth_token)
            client.messages.create(
                body=message,
                from_=self.settings.twilio_from,
                to=self.settings.sms_to,
            )
            return {"channel": "sms", "status": "sent"}
        except Exception as exc:
            return {"channel": "sms", "status": f"failed:{exc}"}

    async def _send_gsm(self, message: str) -> dict[str, str]:
        if not self.settings.enable_gsm:
            return {"channel": "gsm", "status": "disabled"}

        try:
            import serial

            with serial.Serial(self.settings.gsm_serial_port, 9600, timeout=2) as modem:
                modem.write(b"AT\r")
                modem.write(b"AT+CMGF=1\r")
                modem.write(f'AT+CMGS="{self.settings.sms_to}"\r'.encode("utf-8"))
                modem.write(message.encode("utf-8") + b"\x1A")
            return {"channel": "gsm", "status": "sent"}
        except Exception as exc:
            return {"channel": "gsm", "status": f"failed:{exc}"}

    async def _send_lora(self, message: str) -> dict[str, str]:
        if not self.settings.enable_lora:
            return {"channel": "lora", "status": "disabled"}

        try:
            import paho.mqtt.client as mqtt

            client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
            client.connect(self.settings.lora_mqtt_broker, self.settings.lora_mqtt_port, 60)
            client.publish(self.settings.lora_topic, payload=json.dumps({"message": message}), qos=1)
            client.disconnect()
            return {"channel": "lora", "status": "sent"}
        except Exception as exc:
            return {"channel": "lora", "status": f"failed:{exc}"}


dispatcher = NotificationDispatcher()
