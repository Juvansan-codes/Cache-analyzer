import asyncio
import random
import os
from typing import Optional, AsyncGenerator

SERIAL_PORT = os.getenv("SERIAL_PORT", "")


class MockSerial:
    def __init__(self, address_range: int = 256, delay: float = 0.8):
        self.address_range = address_range
        self.delay = delay
        self._running = False

    async def read_stream(self) -> AsyncGenerator[int, None]:
        self._running = True
        while self._running:
            address = random.randint(0, self.address_range - 1)
            yield address
            await asyncio.sleep(self.delay)

    def stop(self):
        self._running = False


class SerialReader:
    def __init__(self, port: str = "", baud_rate: int = 9600, address_range: int = 256):
        self.port = port
        self.baud_rate = baud_rate
        self.address_range = address_range
        self._running = False
        self._serial = None

    async def read_stream(self) -> AsyncGenerator[int, None]:
        if not self.port:
            mock = MockSerial(self.address_range)
            async for addr in mock.read_stream():
                if not self._running:
                    mock.stop()
                    break
                yield addr
            return

        try:
            import serial
            self._serial = serial.Serial(self.port, self.baud_rate, timeout=1)
            self._running = True

            while self._running:
                if self._serial.in_waiting > 0:
                    line = self._serial.readline().decode("utf-8").strip()
                    try:
                        address = int(line)
                        if 0 <= address < self.address_range:
                            yield address
                    except ValueError:
                        pass
                else:
                    await asyncio.sleep(0.05)

        except ImportError:
            mock = MockSerial(self.address_range)
            async for addr in mock.read_stream():
                if not self._running:
                    mock.stop()
                    break
                yield addr
        finally:
            if self._serial and self._serial.is_open:
                self._serial.close()

    def start(self):
        self._running = True

    def stop(self):
        self._running = False
        if self._serial and self._serial.is_open:
            self._serial.close()


def get_serial_reader(address_range: int = 256) -> SerialReader:
    return SerialReader(port=SERIAL_PORT, address_range=address_range)
