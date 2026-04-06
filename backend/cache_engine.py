import math
import random
import time
from collections import OrderedDict, deque
from typing import List, Optional, Dict, Tuple
from models import (
    CacheConfig, CacheLine, AccessResult, CacheState,
    MappingType, ReplacementPolicy
)


class CacheEngine:
    def __init__(self, config: CacheConfig):
        self.config = config
        self.num_lines = config.cache_size
        self.block_size = config.block_size
        self.associativity = config.associativity
        self.address_bits = config.address_bits

        if config.mapping_type == MappingType.DIRECT:
            self.associativity = 1
            self.num_sets = self.num_lines
        elif config.mapping_type == MappingType.FULLY_ASSOCIATIVE:
            self.associativity = self.num_lines
            self.num_sets = 1
        else:
            self.num_sets = max(1, self.num_lines // self.associativity)

        self.offset_bits = max(0, int(math.log2(self.block_size))) if self.block_size > 1 else 0
        self.index_bits = max(0, int(math.log2(self.num_sets))) if self.num_sets > 1 else 0
        self.tag_bits = self.address_bits - self.index_bits - self.offset_bits

        self.cache: List[List[CacheLine]] = []
        self.lru_orders: Dict[int, OrderedDict] = {}
        self.fifo_queues: Dict[int, deque] = {}
        self.access_counts: Dict[Tuple[int, int], int] = {}
        self.heatmap: Dict[int, int] = {}

        self.total_accesses = 0
        self.hits = 0
        self.misses = 0

        self._init_cache()

    def _init_cache(self):
        self.cache = []
        self.lru_orders = {}
        self.fifo_queues = {}
        line_idx = 0
        for s in range(self.num_sets):
            cache_set = []
            for w in range(self.associativity):
                cache_set.append(CacheLine(index=line_idx))
                line_idx += 1
            self.cache.append(cache_set)
            self.lru_orders[s] = OrderedDict()
            self.fifo_queues[s] = deque()

    def _extract_fields(self, address: int) -> Tuple[int, int, int]:
        offset = address & ((1 << self.offset_bits) - 1) if self.offset_bits > 0 else 0
        index = (address >> self.offset_bits) & ((1 << self.index_bits) - 1) if self.index_bits > 0 else 0
        tag = address >> (self.offset_bits + self.index_bits)
        return tag, index, offset

    def access(self, address: int) -> AccessResult:
        self.total_accesses += 1
        self.heatmap[address] = self.heatmap.get(address, 0) + 1

        tag, set_index, offset = self._extract_fields(address)
        cache_set = self.cache[set_index]

        for way_idx, line in enumerate(cache_set):
            line.status = "empty" if not line.valid else "empty"

        hit_way = None
        for way_idx, line in enumerate(cache_set):
            if line.valid and line.tag == tag:
                hit_way = way_idx
                break

        evicted_address: Optional[int] = None
        flat_index: int

        if hit_way is not None:
            self.hits += 1
            line = cache_set[hit_way]
            line.status = "hit"
            line.access_count += 1
            line.last_access = self.total_accesses
            flat_index = set_index * self.associativity + hit_way

            if self.config.replacement_policy == ReplacementPolicy.LRU:
                lru = self.lru_orders[set_index]
                if tag in lru:
                    lru.move_to_end(tag)

            result = AccessResult(
                address=address,
                tag=tag,
                index=set_index,
                hit=True,
                cache_line_index=flat_index,
                set_index=set_index,
            )
        else:
            self.misses += 1
            victim_way = self._find_victim(set_index, cache_set)
            victim_line = cache_set[victim_way]

            if victim_line.valid:
                evicted_address = self._reconstruct_address(victim_line.tag, set_index)
                victim_line.status = "evicted"
                old_tag = victim_line.tag

                if self.config.replacement_policy == ReplacementPolicy.LRU:
                    lru = self.lru_orders[set_index]
                    if old_tag in lru:
                        del lru[old_tag]
                elif self.config.replacement_policy == ReplacementPolicy.FIFO:
                    fifo = self.fifo_queues[set_index]
                    if old_tag in fifo:
                        fifo.remove(old_tag)

            victim_line.valid = True
            victim_line.tag = tag
            victim_line.data = address
            victim_line.status = "miss"
            victim_line.access_count = 1
            victim_line.last_access = self.total_accesses
            flat_index = set_index * self.associativity + victim_way

            if self.config.replacement_policy == ReplacementPolicy.LRU:
                self.lru_orders[set_index][tag] = True
            elif self.config.replacement_policy == ReplacementPolicy.FIFO:
                self.fifo_queues[set_index].append(tag)

            result = AccessResult(
                address=address,
                tag=tag,
                index=set_index,
                hit=False,
                evicted_address=evicted_address,
                cache_line_index=flat_index,
                set_index=set_index,
            )

        return result

    def _find_victim(self, set_index: int, cache_set: List[CacheLine]) -> int:
        for way_idx, line in enumerate(cache_set):
            if not line.valid:
                return way_idx

        policy = self.config.replacement_policy

        if policy == ReplacementPolicy.LRU:
            lru = self.lru_orders[set_index]
            if lru:
                oldest_tag = next(iter(lru))
                for way_idx, line in enumerate(cache_set):
                    if line.tag == oldest_tag:
                        return way_idx
            return 0

        elif policy == ReplacementPolicy.FIFO:
            fifo = self.fifo_queues[set_index]
            if fifo:
                oldest_tag = fifo[0]
                for way_idx, line in enumerate(cache_set):
                    if line.tag == oldest_tag:
                        return way_idx
            return 0

        elif policy == ReplacementPolicy.RANDOM:
            return random.randint(0, len(cache_set) - 1)

        return 0

    def _reconstruct_address(self, tag: int, set_index: int) -> int:
        return (tag << (self.index_bits + self.offset_bits)) | (set_index << self.offset_bits)

    def get_state(self) -> CacheState:
        lines: List[CacheLine] = []
        for cache_set in self.cache:
            for line in cache_set:
                lines.append(line.model_copy())

        hit_rate = self.hits / self.total_accesses if self.total_accesses > 0 else 0.0
        miss_rate = self.misses / self.total_accesses if self.total_accesses > 0 else 0.0
        amat = 1 + (miss_rate * 10)

        return CacheState(
            lines=lines,
            total_accesses=self.total_accesses,
            hits=self.hits,
            misses=self.misses,
            hit_rate=round(hit_rate, 4),
            miss_rate=round(miss_rate, 4),
            amat=round(amat, 2),
        )

    def get_heatmap(self) -> Dict[int, int]:
        return dict(self.heatmap)

    def reset(self):
        self.total_accesses = 0
        self.hits = 0
        self.misses = 0
        self.heatmap.clear()
        self._init_cache()
