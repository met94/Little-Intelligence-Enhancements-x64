function TeamAIMovement:chk_action_forbidden(action_type)
	if action_type == "walk" and self._should_stay then
		if Network:is_server() and self._unit:brain():objective() and (self._unit:brain():objective().type == "revive" or self._unit:brain():objective().forced) then
			return false
		end

		if not self._LIES_check_hold_blocked then
			self._LIES_check_hold_blocked = true
			LIES:LogCheck("team AI hold blocked walk unit=" .. tostring(self._unit:key()))
		end

		return true
	end

	return TeamAIMovement.super.chk_action_forbidden(self, action_type)
end