import random
import asyncio
from typing import AsyncGenerator, List
from models import TraceConfig


class TraceGenerator:
    def __init__(self, config: TraceConfig):
        self.config = config
        self.address_range = config.address_range
        self.count = config.count
        self.pattern = config.pattern

    def generate_batch(self) -> List[int]:
        if self.pattern == "sequential":
            return self._sequential()
        elif self.pattern == "loop":
            return self._loop()
        elif self.pattern == "spatial":
            return self._spatial()
        else:
            return self._random()

    def _random(self) -> List[int]:
        return [random.randint(0, self.address_range - 1) for _ in range(self.count)]

    def _sequential(self) -> List[int]:
        start = random.randint(0, max(0, self.address_range - self.count))
        return [(start + i) % self.address_range for i in range(self.count)]

    def _loop(self) -> List[int]:
        loop_size = min(16, self.address_range)
        base = random.randint(0, self.address_range - loop_size)
        addresses = []
        for i in range(self.count):
            addresses.append(base + (i % loop_size))
        return addresses

    def _spatial(self) -> List[int]:
        addresses = []
        hotspots = [random.randint(0, self.address_range - 1) for _ in range(4)]
        for i in range(self.count):
            hotspot = random.choice(hotspots)
            offset = random.randint(-4, 4)
            addr = max(0, min(self.address_range - 1, hotspot + offset))
            addresses.append(addr)
        return addresses

    async def generate_stream(self, delay: float = 0.1) -> AsyncGenerator[int, None]:
        addresses = self.generate_batch()
        for addr in addresses:
            yield addr
            await asyncio.sleep(delay)
