local key = ModPath .. '	' .. RequiredScript
if _G[key] then return else _G[key] = true end

Hooks:PostHook(SentryGunBase, "activate_as_module", "lies_fix_turret_fuck", function(self)
	self._unit:movement():set_team(self._unit:movement():team()) --run it again idk, fixes turrets being untargetable for bots
end)